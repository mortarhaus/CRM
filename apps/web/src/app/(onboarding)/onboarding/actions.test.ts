import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// Phase 2 plan Task 8: the onboarding action through action() on the real crm_app role, Owner only.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const { completeOnboarding } = await import("./actions");

let database: TestDatabase;
let admin: postgres.Sql;

async function signInToNewWorkspace(role: string): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('onboarding', ${`onboarding-${randomUUID()}`}, now()) returning id`;
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!org || !user) throw new Error("fixture not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${org.id}, ${user.id}, ${role}, now())`;
  await admin`insert into workspace_settings (workspace_id) values (${org.id})`;
  signedIn = { userId: user.id, workspaceId: org.id };
  return org.id;
}

async function settings(workspaceId: string) {
  const [row] = await admin<
    {
      country: string | null;
      tax_registered: boolean;
      tax_registration_no: string | null;
      default_tax_name: string | null;
      default_tax_rate_bps: number | null;
      own_tin: string | null;
    }[]
  >`select country, tax_registered, tax_registration_no, default_tax_name, default_tax_rate_bps, own_tin
      from workspace_settings where workspace_id = ${workspaceId}`;
  if (!row) throw new Error("no settings row");
  return row;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeAll(async () => {
  database = await startDatabase();
  databaseUrl = database.appUrl;
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await admin?.end();
  await database?.stop();
});

describe("completeOnboarding", () => {
  it("Owner, MY, No: sets the country, leaves tax off and ignores the hidden tax fields of the form", async () => {
    const workspaceId = await signInToNewWorkspace("owner");
    const result = await completeOnboarding(
      null,
      form({ expectedVersion: "1", country: "MY", taxRegistered: "no", taxRegistrationNo: "typed", taxName: "Service Tax", taxRate: "8" }),
    );
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: 2 } });
    expect(await settings(workspaceId)).toMatchObject({
      country: "MY",
      tax_registered: false,
      tax_registration_no: null,
      default_tax_name: null,
      default_tax_rate_bps: null,
    });
  });

  it("Owner, SG, Yes: stores the registration number and the edited rate in basis points", async () => {
    const workspaceId = await signInToNewWorkspace("owner");
    const result = await completeOnboarding(
      null,
      form({
        expectedVersion: "1",
        country: "SG",
        taxRegistered: "yes",
        taxRegistrationNo: " M90312345A ",
        taxName: "GST",
        taxRate: "8.5",
        ownTin: "T-1",
        ownBrn: "",
      }),
    );
    expect(result.ok).toBe(true);
    expect(await settings(workspaceId)).toMatchObject({
      country: "SG",
      tax_registered: true,
      tax_registration_no: "M90312345A",
      default_tax_name: "GST",
      default_tax_rate_bps: 850,
      own_tin: "T-1",
    });
  });

  it.each([
    [{ taxRegistrationNo: "" }, ["taxRegistrationNo"]],
    [{ taxRegistrationNo: "   " }, ["taxRegistrationNo"]],
    [{ taxName: "" }, ["taxName"]],
    [{ taxRate: "-1" }, ["taxRate"]],
    [{ taxRate: "8%" }, ["taxRate"]],
  ])("Yes with %j is refused as INVALID_INPUT and writes nothing", async (override, fields) => {
    const workspaceId = await signInToNewWorkspace("owner");
    const yes = { expectedVersion: "1", country: "MY", taxRegistered: "yes", taxRegistrationNo: "W10", taxName: "Service Tax", taxRate: "8" };
    expect(await completeOnboarding(null, form({ ...yes, ...override }))).toEqual({ ok: false, status: "INVALID_INPUT", fields });
    expect((await settings(workspaceId)).country).toBeNull();
  });

  it.each([
    [{ country: "US" }, ["country"]],
    [{ taxRegistered: "" }, ["taxRegistered"]],
  ])("%j is refused as INVALID_INPUT", async (override, fields) => {
    await signInToNewWorkspace("owner");
    const no = { expectedVersion: "1", country: "MY", taxRegistered: "no" };
    expect(await completeOnboarding(null, form({ ...no, ...override }))).toMatchObject({ ok: false, status: "INVALID_INPUT", fields });
  });

  it.each(["admin", "staff"])("%s is refused with FORBIDDEN and nothing is written", async (role) => {
    const workspaceId = await signInToNewWorkspace(role);
    expect(await completeOnboarding(null, form({ expectedVersion: "1", country: "MY", taxRegistered: "no" }))).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect((await settings(workspaceId)).country).toBeNull();
  });

  it("a second onboarding is refused with STALE_VERSION and changes nothing", async () => {
    const workspaceId = await signInToNewWorkspace("owner");
    await completeOnboarding(null, form({ expectedVersion: "1", country: "MY", taxRegistered: "no" }));
    expect(await completeOnboarding(null, form({ expectedVersion: "2", country: "SG", taxRegistered: "no" }))).toEqual({
      ok: false,
      status: "STALE_VERSION",
    });
    expect((await settings(workspaceId)).country).toBe("MY");
  });
});
