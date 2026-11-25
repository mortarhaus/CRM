import { randomUUID } from "node:crypto";
import { LOGO_MAX_BYTES } from "@crm/core/security";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createS3Adapter, type StorageAdapter } from "@/adapters/storage";
import { startMinio, type TestMinio } from "@/test/minio";
import { startDatabase, type TestDatabase } from "@/test/postgres";
import { rendered } from "@/test/rendered";

// Phase 2 plan Task 12: uploadLogo through action() on the real crm_app role and a real MinIO. The signed-in user and
// their active workspace are what action() reads through getCurrentSession().
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));
let storage: StorageAdapter | null = null;
let puts = 0;
vi.mock("@/adapters/storage", async (original) => ({
  ...(await original<typeof import("@/adapters/storage")>()),
  getStorage: () =>
    storage && {
      ...storage,
      put: (...args: Parameters<StorageAdapter["put"]>) => {
        puts += 1;
        return storage?.put(...args) ?? Promise.reject(new Error("no storage"));
      },
    },
}));

const actions = await import("./actions");
const uploadLogo = rendered(actions.uploadLogo, () => signedIn?.workspaceId);

let database: TestDatabase;
let minio: TestMinio;
let realStorage: StorageAdapter;
let admin: postgres.Sql;
let workspaceId = "";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
function oversizePng(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(LOGO_MAX_BYTES + 1);
  bytes.set(PNG);
  return bytes;
}
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

async function signInAs(role: string, workspace = workspaceId): Promise<string> {
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspace}, ${user.id}, ${role}, now())`;
  signedIn = { userId: user.id, workspaceId: workspace };
  return user.id;
}

async function settings(workspace = workspaceId) {
  const [row] = await admin<{ version: number; logo_key: string | null }[]>`
    select version, logo_key from workspace_settings where workspace_id = ${workspace}`;
  if (!row) throw new Error("no settings row");
  return row;
}

async function createWorkspace(country: string | null): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('logo', ${`logo-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  await admin`insert into workspace_settings (workspace_id, country) values (${org.id}, ${country})`;
  return org.id;
}

// The form the branding page posts: the version, and the file as the browser sends it (name and type are the
// client's and are ignored).
function form(version: number, bytes: Uint8Array<ArrayBuffer>, name = "logo.png", type = "image/png"): FormData {
  const data = new FormData();
  data.set("expectedVersion", String(version));
  data.set("logo", new File([bytes], name, { type }));
  return data;
}

const upload = (data: FormData) => uploadLogo(null, data);

beforeAll(async () => {
  [database, minio] = await Promise.all([startDatabase(), startMinio()]);
  databaseUrl = database.appUrl;
  realStorage = createS3Adapter(minio.config);
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  workspaceId = await createWorkspace("MY");
});

beforeEach(() => {
  storage = realStorage;
  puts = 0;
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await admin?.end();
  await Promise.all([database?.stop(), minio?.stop()]);
});

describe("uploadLogo", () => {
  it.each([
    ["owner", PNG, "image/png"],
    ["admin", JPG, "image/jpeg"],
  ])("%s: stores the file under ws/{workspace}/{uuid} with the detected type, sets logo_key and audits it", async (role, bytes, type) => {
    const actor = await signInAs(role);
    const before = await settings();
    // The client says SVG; the bytes say otherwise, and the bytes win.
    const result = await upload(form(before.version, bytes, "logo.svg", "image/svg+xml"));
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: before.version + 1 } });

    const after = await settings();
    expect(after.logo_key).toMatch(new RegExp(`^ws/${workspaceId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`));
    expect(after.logo_key).not.toContain("logo.");
    const object = await realStorage.get(after.logo_key ?? "");
    expect(object?.contentType).toBe(type);
    expect(new Uint8Array(await new Response(object?.body).arrayBuffer())).toEqual(bytes);

    const [audit] = await admin<{ actor_user_id: string; before: unknown; after: unknown }[]>`
      select actor_user_id, before, after from audit_log
      where workspace_id = ${workspaceId} and action = 'workspace_settings.updated' order by created_at desc limit 1`;
    expect(audit).toMatchObject({
      actor_user_id: actor,
      before: { logo_key: before.logo_key, version: before.version },
      after: { logo_key: after.logo_key, version: before.version + 1 },
    });
  });

  it("replacing the logo leaves the old object in place (no delete; the Phase 9 purge removes orphans)", async () => {
    await signInAs("owner");
    const first = await settings();
    await upload(form(first.version, PNG));
    const old = (await settings()).logo_key ?? "";
    await upload(form(first.version + 1, JPG));
    const current = await settings();
    expect(current.logo_key).not.toBe(old);
    expect(await realStorage.head(old)).toEqual({ contentType: "image/png", contentLength: PNG.length });
  });

  it.each([
    ["an SVG named logo.png", form(0, SVG, "logo.png", "image/png"), "UPLOAD_TYPE_NOT_ALLOWED"],
    ["an HTML page named logo.jpg", form(0, new TextEncoder().encode("<html></html>"), "logo.jpg", "image/jpeg"), "UPLOAD_TYPE_NOT_ALLOWED"],
    ["an empty file", form(0, new Uint8Array(0)), "UPLOAD_EMPTY"],
    ["a PNG one byte over the limit", form(0, oversizePng()), "UPLOAD_TOO_LARGE"],
  ])("refuses %s before anything is stored, and changes nothing", async (_name, data, status) => {
    await signInAs("owner");
    const before = await settings();
    data.set("expectedVersion", String(before.version));
    expect(await upload(data)).toEqual({ ok: false, status });
    expect(puts).toBe(0);
    expect(await settings()).toEqual(before);
  });

  it("refuses Staff with FORBIDDEN, before the file is read or stored (AUTH-01)", async () => {
    await signInAs("staff");
    const before = await settings();
    expect(await upload(form(before.version, PNG))).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(puts).toBe(0);
    expect(await settings()).toEqual(before);
  });

  it("refuses a stale version with STALE_VERSION and stores nothing", async () => {
    await signInAs("owner");
    const before = await settings();
    expect(await upload(form(before.version - 1, PNG))).toEqual({ ok: false, status: "STALE_VERSION" });
    expect(puts).toBe(0);
    expect(await settings()).toEqual(before);
  });

  it("refuses a workspace the Owner has not onboarded with NOT_ONBOARDED and stores nothing", async () => {
    const fresh = await createWorkspace(null);
    await signInAs("owner", fresh);
    const before = await settings(fresh);
    expect(await upload(form(before.version, PNG))).toEqual({ ok: false, status: "NOT_ONBOARDED" });
    expect(puts).toBe(0);
    expect(await settings(fresh)).toEqual(before);
  });

  it("refuses with STORAGE_UNAVAILABLE when storage is not configured", async () => {
    storage = null;
    await signInAs("owner");
    const before = await settings();
    expect(await upload(form(before.version, PNG))).toEqual({ ok: false, status: "STORAGE_UNAVAILABLE" });
    expect(await settings()).toEqual(before);
  });

  it("refuses a post without a file as INVALID_INPUT", async () => {
    await signInAs("owner");
    const data = new FormData();
    data.set("expectedVersion", String((await settings()).version));
    data.set("logo", "not a file");
    expect(await upload(data)).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["logo"] });
    expect(puts).toBe(0);
  });
});
