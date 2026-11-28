import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import postgres from "postgres";
import { Agent, cacheStores, interceptors, request } from "undici";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createS3Adapter, type StorageAdapter } from "@/adapters/storage";
import { startMinio, type TestMinio } from "@/test/minio";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// The stale-entry check of the Bank QR's scoped FILE-04 alternative (PROJECT.md §9; spec revision 13): the route's
// real response, served over HTTP, through an RFC 9111 private cache (undici's cache interceptor, in memory). Once
// the hour is over, the saved copy is not reused while the app cannot be reached, and the next request reaches the
// route and its checks again. Fresh reuse within the hour is the accepted risk; it is shown here, not tested in a
// real browser.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && {
      user: { id: signedIn.userId, twoFactorEnabled: true },
      session: { id: "session", activeOrganizationId: signedIn.workspaceId },
    },
}));
let storage: StorageAdapter | null = null;
vi.mock("@/adapters/storage", async (original) => ({
  ...(await original<typeof import("@/adapters/storage")>()),
  getStorage: () => storage,
}));

const { GET } = await import("./route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5, 6]);
const HASH = createHash("sha256").update(PNG).digest("hex");

let database: TestDatabase;
let minio: TestMinio;
let admin: postgres.Sql;
let server: Server;
let hits = 0;

// The route as the origin: each HTTP request becomes a Request to GET, and its Response is written back as is.
function listen(port = 0): Promise<number> {
  server = createServer(async (incoming, outgoing) => {
    hits += 1;
    const response = await GET(new Request(`http://localhost${incoming.url ?? "/"}`));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(outgoing);
    else outgoing.end();
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));
}

function close(): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

beforeAll(async () => {
  [database, minio] = await Promise.all([startDatabase(), startMinio()]);
  databaseUrl = database.appUrl;
  storage = createS3Adapter(minio.config);
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (server?.listening) await close();
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await admin?.end();
  await Promise.all([database?.stop(), minio?.stop()]);
});

describe("GET /files/payment-qr through a private HTTP cache", () => {
  it("reuses a fresh copy, never a stale one while the app is unreachable, and checks again on the next request", async () => {
    const [org] = await admin<{ id: string }[]>`
      insert into organization (name, slug, created_at) values ('cache', ${`cache-${randomUUID()}`}, now()) returning id`;
    const [user] = await admin<{ id: string }[]>`
      insert into "user" (name, email, two_factor_enabled) values ('Admin', ${`admin-${randomUUID()}@example.test`}, true)
      returning id`;
    if (!org || !user) throw new Error("fixture not created");
    const key = `ws/${org.id}/duitnow/${HASH}.png`;
    await storage?.put(key, PNG, "image/png");
    await admin`insert into workspace_settings (workspace_id, country, duitnow_qr_key) values (${org.id}, 'MY', ${key})`;
    await admin`insert into member (organization_id, user_id, role, created_at) values (${org.id}, ${user.id}, 'admin', now())`;
    signedIn = { userId: user.id, workspaceId: org.id };

    const port = await listen();
    const origin = `http://127.0.0.1:${port}`;
    const path = `/files/payment-qr?id=${HASH}`;
    const store = new cacheStores.MemoryCacheStore();
    const browser = new Agent().compose(interceptors.cache({ store, type: "private" }));
    const fetchQr = async () => {
      // The client lets the cache serve a stale copy when the origin fails (stale-if-error, RFC 5861), as a browser
      // may when disconnected (RFC 9111 §4.2.4); only must-revalidate forbids it.
      const response = await request(`${origin}${path}`, {
        dispatcher: browser,
        headers: { "cache-control": "stale-if-error=86400" },
      });
      const body = new Uint8Array(await response.body.arrayBuffer());
      return { status: response.statusCode, cacheControl: response.headers["cache-control"], body };
    };

    const first = await fetchQr();
    expect(first).toEqual({ status: 200, cacheControl: "private, max-age=3600, must-revalidate", body: PNG });
    expect(hits).toBe(1);
    // Fresh: reused without asking the route (the accepted risk, up to an hour).
    expect((await fetchQr()).body).toEqual(PNG);
    expect(hits).toBe(1);

    // An hour and a second later (no storage call runs from here on, so request signing never sees this clock). The
    // copy is stale but still held by the cache, so what follows tests must-revalidate, not an evicted entry.
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 3_601_000);
    const held = await store.get({ origin, method: "GET", path, headers: {} });
    expect(held?.statusCode).toBe(200);
    expect(Date.now()).toBeGreaterThan(held?.staleAt ?? Infinity);

    // The app cannot be reached: the stale copy is not served, even though the client would accept it.
    await close();
    await expect(fetchQr()).rejects.toThrow();
    expect(hits).toBe(1);

    // The app is back and the member has signed out: the request reaches the route, which refuses it.
    await listen(port);
    signedIn = null;
    const after = await fetchQr();
    expect(hits).toBe(2);
    expect(after).toEqual({ status: 404, cacheControl: "no-store", body: new Uint8Array() });
    await browser.close();
  });
});
