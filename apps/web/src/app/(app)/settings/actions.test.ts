import { randomUUID } from "node:crypto";
import { ADDRESS_LINE_MAX_LENGTH } from "@crm/core/security";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// Phase 2 plan Task 5: the settings actions through action() on the real crm_app role. The signed-in user and their
// active workspace are what action() reads through getCurrentSession().
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const { updateBrandingSettings, updateGeneralSettings } = await import("./actions");

let database: TestDatabase;
let admin: postgres.Sql;
let workspaceId = "";

async function signInAs(role: string): Promise<string> {
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${user.id}, ${role}, now())`;
  signedIn = { userId: user.id, workspaceId };
  return user.id;
}

async function settings() {
  const [row] = await admin<{ version: number; brand_colour: string | null; short_code: string | null }[]>`
    select version, brand_colour, short_code from workspace_settings where workspace_id = ${workspaceId}`;
  if (!row) throw new Error("no settings row");
  return row;
}

const auditCount = async () =>
  (await admin`select 1 from audit_log where workspace_id = ${workspaceId} and action = 'workspace_settings.updated'`).length;

beforeAll(async () => {
  database = await startDatabase();
  databaseUrl = database.appUrl;
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('settings', ${`settings-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  workspaceId = org.id;
  await admin`insert into workspace_settings (workspace_id) values (${workspaceId})`;
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await admin?.end();
  await database?.stop();
});

describe("updateBrandingSettings", () => {
  it.each(["owner", "admin"])("%s: saves the colour lower-cased, bumps the version and writes one audit row", async (role) => {
    const actor = await signInAs(role);
    const { version } = await settings();
    const audits = await auditCount();
    expect(await updateBrandingSettings({ expectedVersion: version, brandColour: ` #A1B2C${role === "owner" ? 3 : 4} ` })).toEqual({
      ok: true,
      status: "DONE",
      data: { version: version + 1 },
    });
    expect(await settings()).toMatchObject({ version: version + 1, brand_colour: `#a1b2c${role === "owner" ? 3 : 4}` });
    expect(await auditCount()).toBe(audits + 1);
    const [row] = await admin<{ actor_user_id: string }[]>`
      select actor_user_id from audit_log where workspace_id = ${workspaceId} order by created_at desc limit 1`;
    expect(row?.actor_user_id).toBe(actor);
  });

  it("refuses Staff with FORBIDDEN and changes nothing", async () => {
    await signInAs("staff");
    const before = await settings();
    expect(await updateBrandingSettings({ expectedVersion: before.version, brandColour: "#000000" })).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect(await settings()).toEqual(before);
  });

  it("refuses a stale version with STALE_VERSION and changes nothing", async () => {
    await signInAs("owner");
    const before = await settings();
    const audits = await auditCount();
    expect(await updateBrandingSettings({ expectedVersion: before.version - 1, brandColour: "#000000" })).toEqual({
      ok: false,
      status: "STALE_VERSION",
    });
    expect(await settings()).toEqual(before);
    expect(await auditCount()).toBe(audits);
  });

  it.each([
    ["CSS in the colour", { brandColour: "#fff;}body{x:y" }, ["brandColour"]],
    ["a short hex", { brandColour: "#fff" }, ["brandColour"]],
    ["an unknown key", { brandColour: "#000000", logoKey: "ws/x" }, [""]],
    ["no version", { brandColour: "#000000", expectedVersion: undefined }, ["expectedVersion"]],
  ])("refuses %s with INVALID_INPUT and changes nothing", async (_case, input, fields) => {
    await signInAs("owner");
    const before = await settings();
    expect(await updateBrandingSettings({ expectedVersion: before.version, ...input })).toEqual({
      ok: false,
      status: "INVALID_INPUT",
      fields,
    });
    expect(await settings()).toEqual(before);
  });
});

describe("updateGeneralSettings", () => {
  it("saves the short code upper-cased and clears an empty address line", async () => {
    await signInAs("admin");
    const { version } = await settings();
    const result = await updateGeneralSettings({ expectedVersion: version, shortCode: "ms1", addressLine1: "1 Jalan", addressLine2: "" });
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: version + 1 } });
    expect(await settings()).toMatchObject({ short_code: "MS1" });
  });

  it.each([
    ["a short code of 7", { shortCode: "ABCDEFG" }, ["shortCode"]],
    ["a control character", { addressLine1: "1 Jalan\u0000" }, ["addressLine1"]],
    ["an address line over the limit", { addressLine1: "x".repeat(ADDRESS_LINE_MAX_LENGTH + 1) }, ["addressLine1"]],
    ["a field of another group", { brandColour: "#000000" }, [""]],
  ])("refuses %s with INVALID_INPUT", async (_case, input, fields) => {
    await signInAs("owner");
    const { version } = await settings();
    expect(await updateGeneralSettings({ expectedVersion: version, ...input })).toEqual({ ok: false, status: "INVALID_INPUT", fields });
  });
});
