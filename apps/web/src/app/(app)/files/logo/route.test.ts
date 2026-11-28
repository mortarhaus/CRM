import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createS3Adapter, type StorageAdapter } from "@/adapters/storage";
import { logoUrl } from "@/lib/uploads/logo";
import { startMinio, type TestMinio } from "@/test/minio";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// Phase 2 plan Task 12: the logo serve route on the real crm_app role (RLS) and a real MinIO, with two workspaces.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));
let storage: StorageAdapter | null = null;
vi.mock("@/adapters/storage", async (original) => ({
  ...(await original<typeof import("@/adapters/storage")>()),
  getStorage: () => storage,
}));

const { GET } = await import("./route");

let database: TestDatabase;
let minio: TestMinio;
let admin: postgres.Sql;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function workspaceWithLogo(): Promise<{ id: string; key: string }> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('serve', ${`serve-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  const key = `ws/${org.id}/${randomUUID()}`;
  await storage?.put(key, PNG, "image/png");
  await admin`insert into workspace_settings (workspace_id, country, logo_key) values (${org.id}, 'MY', ${key})`;
  return { id: org.id, key };
}

async function memberOf(workspaceId: string, role = "staff"): Promise<void> {
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${user.id}, ${role}, now())`;
  signedIn = { userId: user.id, workspaceId };
}

const get = (path: string) => GET(new Request(`http://localhost:3000${path}`));

// Every refusal is the same 404 with no-store and no body, never a cacheable image (TEN-05; the FILE-04 exception in
// PROJECT.md §9).
async function expectRefused(response: Response): Promise<void> {
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-type")).toBeNull();
  expect((await response.arrayBuffer()).byteLength).toBe(0);
}

beforeAll(async () => {
  [database, minio] = await Promise.all([startDatabase(), startMinio()]);
  databaseUrl = database.appUrl;
  storage = createS3Adapter(minio.config);
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await admin?.end();
  await Promise.all([database?.stop(), minio?.stop()]);
});

describe("GET /files/logo", () => {
  it("streams the current logo to any member (Staff too), with a safe type, nosniff, attachment and private caching", async () => {
    const a = await workspaceWithLogo();
    await memberOf(a.id, "staff");
    const response = await get(logoUrl(a.key));
    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "image/png",
      "content-length": String(PNG.length),
      "content-disposition": "attachment",
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    });
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("answers 404 to a member of another workspace for the first workspace's logo (TEN-05)", async () => {
    const a = await workspaceWithLogo();
    const b = await workspaceWithLogo();
    await memberOf(b.id, "owner");
    await expectRefused(await get(logoUrl(a.key)));
    // Their own logo still works.
    expect((await get(logoUrl(b.key))).status).toBe(200);
    // A session pointed at A, without a membership of A, is no better.
    signedIn = { userId: signedIn?.userId ?? "", workspaceId: a.id };
    await expectRefused(await get(logoUrl(a.key)));
  });

  it("answers 404 signed out, for an old or unknown id, a malformed id, and with storage off", async () => {
    const a = await workspaceWithLogo();
    signedIn = null;
    await expectRefused(await get(logoUrl(a.key)));
    await memberOf(a.id);
    await expectRefused(await get(`/files/logo?id=${randomUUID()}`));
    await expectRefused(await get("/files/logo?id=../../other"));
    await expectRefused(await get("/files/logo"));
    storage = null;
    try {
      await expectRefused(await get(logoUrl(a.key)));
    } finally {
      storage = createS3Adapter(minio.config);
    }
  });

  it("never serves an object whose stored type is not PNG or JPG", async () => {
    const a = await workspaceWithLogo();
    await storage?.put(a.key, new TextEncoder().encode("<svg/>"), "image/svg+xml");
    await memberOf(a.id);
    await expectRefused(await get(logoUrl(a.key)));
  });
});
