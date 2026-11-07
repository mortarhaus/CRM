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
  const [row] = await admin<
    {
      version: number;
      brand_colour: string | null;
      short_code: string | null;
      timezone: string | null;
      base_currency: string | null;
      default_currency: string | null;
      tax_registered: boolean;
      tax_registration_no: string | null;
      default_tax_name: string | null;
      default_tax_rate_bps: number | null;
      own_tin: string | null;
    }[]
  >`select version, brand_colour, short_code, timezone, base_currency, default_currency, tax_registered, tax_registration_no,
      default_tax_name, default_tax_rate_bps, own_tin
    from workspace_settings where workspace_id = ${workspaceId}`;
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
  // An onboarded workspace (Task 8 sets the country); settings writes before onboarding are refused (PR #56 P3).
  await admin`insert into workspace_settings (workspace_id, country, timezone, base_currency, default_currency)
    values (${workspaceId}, 'MY', 'Asia/Kuala_Lumpur', 'MYR', 'MYR')`;
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

  // The branding page posts its form through useActionState: (previous state, form data).
  function brandingForm(fields: Record<string, string>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);
    return form;
  }

  it("takes a form post's fields from the form, not from the previous state", async () => {
    await signInAs("admin");
    const { version } = await settings();
    const previous = { ok: false, status: "STALE_VERSION" };
    const form = brandingForm({ expectedVersion: String(version), brandColour: "#FFE066", extra: "ignored" });
    expect(await updateBrandingSettings(previous, form)).toEqual({ ok: true, status: "DONE", data: { version: version + 1 } });
    expect(await settings()).toMatchObject({ version: version + 1, brand_colour: "#ffe066" });
  });

  it.each([
    ["CSS in the colour", { brandColour: "#fff;}body{x:y" }, ["brandColour"]],
    ["no version", { brandColour: "#000000", expectedVersion: "" }, ["expectedVersion"]],
    ["a non-numeric version", { brandColour: "#000000", expectedVersion: "1;drop" }, ["expectedVersion"]],
  ])("refuses a form post with %s and changes nothing", async (_case, fields, paths) => {
    await signInAs("owner");
    const before = await settings();
    const form = brandingForm({ expectedVersion: String(before.version), ...fields });
    expect(await updateBrandingSettings(null, form)).toEqual({ ok: false, status: "INVALID_INPUT", fields: paths });
    expect(await settings()).toEqual(before);
  });
});

describe("updateGeneralSettings", () => {
  const no = { taxRegistered: false } as const;
  const yes = { taxRegistered: true, taxRegistrationNo: "W10-1808-32000001", taxName: "Service Tax", taxRate: "8" } as const;

  it("saves the short code upper-cased and clears an empty address line; not a change for new documents only", async () => {
    await signInAs("admin");
    const { version } = await settings();
    const result = await updateGeneralSettings({ expectedVersion: version, ...no, shortCode: "ms1", addressLine1: "1 Jalan", addressLine2: "" });
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: version + 1, newDocumentsOnly: false } });
    expect(await settings()).toMatchObject({ short_code: "MS1" });
  });

  it("clears the short code with an empty string, as text fields do", async () => {
    await signInAs("owner");
    const { version } = await settings();
    await updateGeneralSettings({ expectedVersion: version, ...no, shortCode: "AB" });
    expect(await updateGeneralSettings({ expectedVersion: version + 1, ...no, shortCode: "  " })).toMatchObject({ ok: true });
    expect(await settings()).toMatchObject({ short_code: null });
  });

  it("Yes stores the number, the tax name and the rate in basis points, and is a change for new documents only", async () => {
    await signInAs("admin");
    const { version } = await settings();
    const result = await updateGeneralSettings({ expectedVersion: version, ...yes, taxRate: "6.5", ownTin: "IG123" });
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: version + 1, newDocumentsOnly: true } });
    expect(await settings()).toMatchObject({
      tax_registered: true,
      tax_registration_no: "W10-1808-32000001",
      default_tax_name: "Service Tax",
      default_tax_rate_bps: 650,
      own_tin: "IG123",
    });
    const [audit] = await admin<{ after: Record<string, unknown> }[]>`
      select after from audit_log where workspace_id = ${workspaceId} order by created_at desc limit 1`;
    expect(audit?.after).toMatchObject({ tax_registration_no: "[pii]", own_tin: "[pii]", default_tax_rate_bps: 650 });
  });

  it("No turns tax off and clears the default tax, keeping the registration number", async () => {
    await signInAs("owner");
    const { version } = await settings();
    await updateGeneralSettings({ expectedVersion: version, ...yes });
    expect(await updateGeneralSettings({ expectedVersion: version + 1, ...no })).toMatchObject({ data: { newDocumentsOnly: true } });
    expect(await settings()).toMatchObject({
      tax_registered: false,
      tax_registration_no: "W10-1808-32000001",
      default_tax_name: null,
      default_tax_rate_bps: null,
    });
  });

  it("saves a timezone from Intl and a supported currency; only the base currency counts for new documents only", async () => {
    await signInAs("admin");
    const { version } = await settings();
    expect(await updateGeneralSettings({ expectedVersion: version, ...no, timezone: "Asia/Singapore", defaultCurrency: "SGD" })).toMatchObject({
      data: { newDocumentsOnly: false },
    });
    expect(await updateGeneralSettings({ expectedVersion: version + 1, ...no, baseCurrency: "SGD" })).toMatchObject({
      data: { newDocumentsOnly: true },
    });
    expect(await settings()).toMatchObject({ timezone: "Asia/Singapore", base_currency: "SGD", default_currency: "SGD" });
  });

  it.each([
    ["a short code of 7", { ...no, shortCode: "ABCDEFG" }, ["shortCode"]],
    ["a control character", { ...no, addressLine1: "1 Jalan\u0000" }, ["addressLine1"]],
    ["a right-to-left override (format character)", { ...no, addressLine1: "1 Jalan\u202Eabc" }, ["addressLine1"]],
    ["a zero-width space (format character)", { ...no, addressCity: "Kuala\u200BLumpur" }, ["addressCity"]],
    ["an address line over the limit", { ...no, addressLine1: "x".repeat(ADDRESS_LINE_MAX_LENGTH + 1) }, ["addressLine1"]],
    ["a field of another group", { ...no, brandColour: "#000000" }, [""]],
    ["no SST/GST answer", {}, ["taxRegistered"]],
    ["Yes with no registration number", { ...yes, taxRegistrationNo: " " }, ["taxRegistrationNo"]],
    ["Yes with no tax name", { ...yes, taxName: "" }, ["taxName"]],
    ["Yes with a negative rate", { ...yes, taxRate: "-1" }, ["taxRate"]],
    ["a default tax with No", { ...no, taxName: "Service Tax" }, [""]],
    ["a timezone Intl does not know", { ...no, timezone: "Mars/Olympus_Mons" }, ["timezone"]],
    ["a currency other than MYR and SGD", { ...no, baseCurrency: "USD" }, ["baseCurrency"]],
  ])("refuses %s with INVALID_INPUT and changes nothing", async (_case, input, fields) => {
    await signInAs("owner");
    const before = await settings();
    expect(await updateGeneralSettings({ expectedVersion: before.version, ...input })).toEqual({ ok: false, status: "INVALID_INPUT", fields });
    expect(await settings()).toEqual(before);
  });

  it("refuses Staff with FORBIDDEN and a stale version with STALE_VERSION", async () => {
    await signInAs("staff");
    const before = await settings();
    expect(await updateGeneralSettings({ expectedVersion: before.version, ...no, shortCode: "ST" })).toEqual({ ok: false, status: "FORBIDDEN" });
    await signInAs("admin");
    expect(await updateGeneralSettings({ expectedVersion: before.version - 1, ...no, shortCode: "ST" })).toEqual({
      ok: false,
      status: "STALE_VERSION",
    });
    expect(await settings()).toEqual(before);
  });

  // The general settings page posts its whole form, with or without JavaScript.
  function generalForm(fields: Record<string, string>): FormData {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);
    return form;
  }

  it("a form post with No ignores the hidden tax fields; a refused one echoes no personal data", async () => {
    await signInAs("admin");
    const { version } = await settings();
    const posted = {
      expectedVersion: String(version),
      shortCode: "FP",
      addressLine1: "2 Jalan",
      addressLine2: "",
      addressCity: "",
      addressPostcode: "",
      addressState: "",
      timezone: "Asia/Kuala_Lumpur",
      baseCurrency: "MYR",
      defaultCurrency: "MYR",
      taxRegistered: "no",
      taxRegistrationNo: "typed",
      taxName: "Service Tax",
      taxRate: "8",
      ownTin: "IG9",
      ownBrn: "",
    };
    expect(await updateGeneralSettings(null, generalForm(posted))).toMatchObject({ ok: true });
    expect(await settings()).toMatchObject({ short_code: "FP", tax_registered: false, default_tax_name: null, own_tin: "IG9" });

    const refused = await updateGeneralSettings(
      null,
      generalForm({ ...posted, expectedVersion: String(version + 1), taxRegistered: "yes", taxRegistrationNo: "", taxRate: "8" }),
    );
    expect(refused).toEqual({
      ok: false,
      status: "INVALID_INPUT",
      fields: ["taxRegistrationNo"],
      echo: {
        shortCode: "FP",
        timezone: "Asia/Kuala_Lumpur",
        baseCurrency: "MYR",
        defaultCurrency: "MYR",
        taxRegistered: "yes",
        taxName: "Service Tax",
        taxRate: "8",
      },
    });
  });
});

// PR #56 P3: before the Owner has onboarded (no country), no settings write is taken, so an Admin cannot set the tax
// state that onboarding would then leave as it found it.
describe("settings writes before onboarding", () => {
  it.each([
    ["owner", "NOT_ONBOARDED"],
    ["admin", "NOT_ONBOARDED"],
    ["staff", "FORBIDDEN"],
  ])("%s is refused with %s by both settings actions, and nothing is written", async (role, status) => {
    const [org] = await admin<{ id: string }[]>`
      insert into organization (name, slug, created_at) values ('pending', ${`pending-${randomUUID()}`}, now()) returning id`;
    if (!org) throw new Error("workspace not created");
    await admin`insert into workspace_settings (workspace_id) values (${org.id})`;
    const [user] = await admin<{ id: string }[]>`
      insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
    if (!user) throw new Error("user not created");
    await admin`insert into member (organization_id, user_id, role, created_at) values (${org.id}, ${user.id}, ${role}, now())`;
    signedIn = { userId: user.id, workspaceId: org.id };

    const refused = { ok: false, status };
    expect(await updateGeneralSettings({ expectedVersion: 1, taxRegistered: true, taxRegistrationNo: "W1", taxName: "T", taxRate: "8" })).toEqual(refused);
    expect(await updateBrandingSettings({ expectedVersion: 1, brandColour: "#000000" })).toEqual(refused);
    const [row] = await admin<{ version: number; tax_registered: boolean }[]>`
      select version, tax_registered from workspace_settings where workspace_id = ${org.id}`;
    expect(row).toEqual({ version: 1, tax_registered: false });
  });
});
