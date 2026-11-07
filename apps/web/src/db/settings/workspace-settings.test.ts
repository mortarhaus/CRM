import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sqlState, startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { organization, workspaceSettings } from "../schema";
import { runInWorkspace } from "../workspace";
import { findShellSettings, getSettings, StaleSettingsError, updateSettings } from "./workspace-settings";

// Phase 2 plan Tasks 4-5: the CHECKs and the settings data layer, as crm_app under RLS.
let database: TestDatabase;
let admin: postgres.Sql;
let handle: DbHandle;
let workspaceId: string;
let actor: string;

const inWorkspace = <T>(fn: Parameters<typeof runInWorkspace<T>>[2]) => runInWorkspace(handle.db, workspaceId, fn);
const setRaw = (assignment: ReturnType<typeof sql>) =>
  sqlState(inWorkspace((tx) => tx.execute(sql`update workspace_settings set ${assignment}`)));
const auditRows = () =>
  admin<{ actor_user_id: string; target_id: string; before: unknown; after: unknown }[]>`
    select actor_user_id, target_id, before, after from audit_log
     where workspace_id = ${workspaceId} and action = 'workspace_settings.updated' order by created_at`;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl, { max: 1 });
  const [org] = await handle.db
    .insert(organization)
    .values({ name: "settings", slug: `settings-${randomUUID()}`, createdAt: new Date() })
    .returning({ id: organization.id });
  if (!org) throw new Error("workspace not created");
  workspaceId = org.id;
  await inWorkspace((tx) => tx.insert(workspaceSettings).values({ workspaceId }));
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Settings', ${`settings-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  actor = user.id;
});

afterAll(async () => {
  await handle?.sql.end();
  await admin?.end();
  await database?.stop();
});

describe("workspace_settings CHECKs (crm_app)", () => {
  it.each(["#fff;}body{x:y", "#FFFFFF", "#ffffff\n", "#fff", "red", "#0e6c84 "])("refuses brand_colour %j (23514)", async (value) => {
    expect(await setRaw(sql`brand_colour = ${value}`)).toBe("23514");
  });

  it.each([
    ["a default tax on a workspace that is not tax-registered", sql`default_tax_name = 'Tax', default_tax_rate_bps = 800`],
    ["a negative tax rate", sql`tax_registered = true, tax_registration_no = 'W10-1', default_tax_rate_bps = -1`],
    ["a tax-registered workspace with no registration number", sql`tax_registered = true`],
    ["a rounding other than rate_group", sql`tax_rounding = 'line'`],
    ["an agreement pattern outside the two", sql`default_agreement_pattern = 'nda'`],
    ["a lower-case country", sql`country = 'my'`],
    ["a lower-case short code", sql`short_code = 'abc'`],
    ["an empty address line", sql`address_line1 = ''`],
    ["a logo key in another workspace's prefix", sql`logo_key = ${`ws/${randomUUID()}/${randomUUID()}`}`],
  ])("refuses %s (23514)", async (_case, assignment) => {
    expect(await setRaw(assignment)).toBe("23514");
  });

  it("accepts a tax-registered default with a zero rate, and the workspace's own logo key", async () => {
    const logoKey = `ws/${workspaceId}/${randomUUID()}`;
    expect(await setRaw(sql`tax_registered = true, tax_registration_no = 'W10-1', default_tax_name = 'Tax', default_tax_rate_bps = 0, logo_key = ${logoKey}`)).toBeUndefined();
    expect(await setRaw(sql`tax_registered = false, tax_registration_no = null, default_tax_name = null, default_tax_rate_bps = null`)).toBeUndefined();
  });

  it.each(["workspace_id = workspace_id", "created_at = now()"])("refuses an UPDATE of %s (42501, per-column grants)", async (set) => {
    expect(await setRaw(sql.raw(set))).toBe("42501");
  });
});

describe("updateSettings", () => {
  it("applies the patch to the expected version, bumps it, and audits the changed fields with PII redacted", async () => {
    const before = await inWorkspace((tx) => getSettings(tx));
    const updated = await inWorkspace((tx) =>
      updateSettings(tx, { brandColour: "#0a0b0c", addressCity: "Kuala Lumpur" }, before.version, actor),
    );
    expect(updated).toMatchObject({ brandColour: "#0a0b0c", addressCity: "Kuala Lumpur", version: before.version + 1 });
    expect((await auditRows()).at(-1)).toEqual({
      actor_user_id: actor,
      target_id: workspaceId,
      before: { brand_colour: before.brandColour, address_city: "[pii]", version: before.version },
      after: { brand_colour: "#0a0b0c", address_city: "[pii]", version: before.version + 1 },
    });
  });

  it("refuses a stale version and writes nothing", async () => {
    const current = await inWorkspace((tx) => getSettings(tx));
    const audits = (await auditRows()).length;
    await expect(
      inWorkspace((tx) => updateSettings(tx, { brandColour: "#111111" }, current.version - 1, actor)),
    ).rejects.toBeInstanceOf(StaleSettingsError);
    expect(await inWorkspace((tx) => getSettings(tx))).toEqual(current);
    expect(await auditRows()).toHaveLength(audits);
  });

  it("writes nothing for a patch that changes nothing", async () => {
    const current = await inWorkspace((tx) => getSettings(tx));
    const audits = (await auditRows()).length;
    const result = await inWorkspace((tx) => updateSettings(tx, { brandColour: current.brandColour }, current.version, actor));
    expect(result).toEqual(current);
    expect(await auditRows()).toHaveLength(audits);
  });
});

describe("findShellSettings", () => {
  it("reads the workspace's colour and country, and nulls for a workspace with no settings row yet", async () => {
    await setRaw(sql`brand_colour = '#123abc', country = 'MY'`);
    expect(await inWorkspace((tx) => findShellSettings(tx))).toEqual({ brandColour: "#123abc", country: "MY" });
    const [other] = await handle.db
      .insert(organization)
      .values({ name: "no settings", slug: `no-settings-${randomUUID()}`, createdAt: new Date() })
      .returning({ id: organization.id });
    if (!other) throw new Error("workspace not created");
    expect(await runInWorkspace(handle.db, other.id, (tx) => findShellSettings(tx))).toEqual({ brandColour: null, country: null });
  });
});
