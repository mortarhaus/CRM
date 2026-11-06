import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";
import { AlreadyOnboardedError, applyCountryDefaults, type OnboardingAnswer } from "./apply-country-defaults";
import { getSettings, StaleSettingsError } from "./workspace-settings";

// Phase 2 plan Task 8: the onboarding answer and the country defaults, as crm_app under RLS. Only empty fields are
// filled, and the values the spec does not give (plan Q10) stay empty.
let database: TestDatabase;
let admin: postgres.Sql;
let handle: DbHandle;
let actor: string;

const NO_TAX = { registered: false } as const;

async function newWorkspace(): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('onboarding', ${`onboarding-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  await admin`insert into workspace_settings (workspace_id) values (${org.id})`;
  return org.id;
}

const settingsOf = (workspaceId: string) => runInWorkspace(handle.db, workspaceId, (tx) => getSettings(tx));

function apply(workspaceId: string, answer: OnboardingAnswer, version = 1) {
  return runInWorkspace(handle.db, workspaceId, (tx) => applyCountryDefaults(tx, answer, version, actor));
}

const auditRows = (workspaceId: string) =>
  admin<{ action: string; actor_user_id: string; before: Record<string, unknown>; after: Record<string, unknown> }[]>`
    select action, actor_user_id, before, after from audit_log where workspace_id = ${workspaceId} order by created_at`;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl, { max: 1 });
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Owner', ${`owner-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  actor = user.id;
});

afterAll(async () => {
  await handle?.sql.end();
  await admin?.end();
  await database?.stop();
});

describe("applyCountryDefaults", () => {
  it("MY, not registered: MYR, Asia/Kuala_Lumpur, dd/mm/yyyy; no locale; tax off with every tax field empty", async () => {
    const workspaceId = await newWorkspace();
    const updated = await apply(workspaceId, { country: "MY", tax: NO_TAX, ownTin: null, ownBrn: null });
    expect(updated).toMatchObject({
      country: "MY",
      baseCurrency: "MYR",
      defaultCurrency: "MYR",
      timezone: "Asia/Kuala_Lumpur",
      dateFormat: "dd/mm/yyyy",
      locale: null,
      taxRegistered: false,
      taxRegistrationNo: null,
      defaultTaxName: null,
      defaultTaxRateBps: null,
      ownTin: null,
      ownBrn: null,
      version: 2,
    });
  });

  it("SG, GST-registered: SGD, Asia/Singapore, the edited tax; the date format and locale stay empty (plan Q10)", async () => {
    const workspaceId = await newWorkspace();
    const updated = await apply(workspaceId, {
      country: "SG",
      tax: { registered: true, registrationNo: "M90312345A", taxName: "GST", taxRateBps: 900 },
      ownTin: "T-1",
      ownBrn: "201912345K",
    });
    expect(updated).toMatchObject({
      country: "SG",
      baseCurrency: "SGD",
      defaultCurrency: "SGD",
      timezone: "Asia/Singapore",
      dateFormat: null,
      locale: null,
      taxRegistered: true,
      taxRegistrationNo: "M90312345A",
      defaultTaxName: "GST",
      defaultTaxRateBps: 900,
      ownTin: "T-1",
      ownBrn: "201912345K",
    });
  });

  it("audits the change as workspace_settings.onboarded, with the registration numbers redacted", async () => {
    const workspaceId = await newWorkspace();
    await apply(workspaceId, {
      country: "MY",
      tax: { registered: true, registrationNo: "W10-1808-32000001", taxName: "Service Tax", taxRateBps: 800 },
      ownTin: "C1234567890",
      ownBrn: null,
    });
    const [row, ...rest] = await auditRows(workspaceId);
    expect(rest).toHaveLength(0);
    expect(row?.action).toBe("workspace_settings.onboarded");
    expect(row?.actor_user_id).toBe(actor);
    expect(row?.after).toEqual({
      country: "MY",
      timezone: "Asia/Kuala_Lumpur",
      date_format: "dd/mm/yyyy",
      base_currency: "MYR",
      default_currency: "MYR",
      tax_registered: true,
      tax_registration_no: "[pii]",
      default_tax_name: "Service Tax",
      default_tax_rate_bps: 800,
      own_tin: "[pii]",
      version: 2,
    });
  });

  it("never overwrites a field that is already set", async () => {
    const workspaceId = await newWorkspace();
    await admin`
      update workspace_settings set timezone = 'Asia/Singapore', base_currency = 'USD', own_brn = 'kept'
       where workspace_id = ${workspaceId}`;
    const updated = await apply(workspaceId, { country: "MY", tax: NO_TAX, ownTin: null, ownBrn: "typed" });
    expect(updated).toMatchObject({
      country: "MY",
      timezone: "Asia/Singapore",
      baseCurrency: "USD",
      defaultCurrency: "MYR",
      dateFormat: "dd/mm/yyyy",
      ownBrn: "kept",
    });
  });

  it("refuses a workspace that already has a country and writes nothing", async () => {
    const workspaceId = await newWorkspace();
    await apply(workspaceId, { country: "MY", tax: NO_TAX, ownTin: null, ownBrn: null });
    const before = await settingsOf(workspaceId);
    await expect(apply(workspaceId, { country: "SG", tax: NO_TAX, ownTin: null, ownBrn: null }, before.version)).rejects.toBeInstanceOf(
      AlreadyOnboardedError,
    );
    expect(await settingsOf(workspaceId)).toEqual(before);
    expect(await auditRows(workspaceId)).toHaveLength(1);
  });

  it("refuses a stale version and writes nothing", async () => {
    const workspaceId = await newWorkspace();
    await expect(apply(workspaceId, { country: "MY", tax: NO_TAX, ownTin: null, ownBrn: null }, 0)).rejects.toBeInstanceOf(
      StaleSettingsError,
    );
    expect((await settingsOf(workspaceId)).country).toBeNull();
    expect(await auditRows(workspaceId)).toHaveLength(0);
  });
});
