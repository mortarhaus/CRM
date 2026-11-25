import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startDatabase, type TestDatabase } from "@/test/postgres";
import { rendered } from "@/test/rendered";

// Phase 2 plan Task 8: the onboarding action through action() on the real crm_app role, Owner only.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const actions = await import("./actions");
const completeOnboarding = rendered(actions.completeOnboarding, () => signedIn?.workspaceId);

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
      short_code: string | null;
    }[]
  >`select country, tax_registered, tax_registration_no, default_tax_name, default_tax_rate_bps, own_tin, short_code
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
    // Done: a redirect from the action itself (a 303), so a form posted without JavaScript ends in the app. The page
    // it was posted from would redirect while rendering instead, a 307 that repeats the POST at "/".
    await expect(
      completeOnboarding(
        null,
        form({ expectedVersion: "1", country: "MY", taxRegistered: "no", taxRegistrationNo: "typed", taxName: "Service Tax", taxRate: "8" }),
      ),
    ).rejects.toMatchObject({ url: "/" });
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
    const result = completeOnboarding(
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
    await expect(result).rejects.toMatchObject({ url: "/" });
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
    const posted = { ...yes, ...override, ownTin: "T-1", ownBrn: "B-1" };
    // The answer and the tax name and rate come back for the form to show again; the number, TIN and BRN never do.
    expect(await completeOnboarding(null, form(posted))).toEqual({
      ok: false,
      status: "INVALID_INPUT",
      fields,
      echo: { taxRegistered: "yes", taxName: posted.taxName, taxRate: posted.taxRate },
    });
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

  // Charlie 2026-11-24: onboarding asks for the short code with the rule of General settings (lib/settings-input.ts),
  // and it can be skipped. The code is audited with the other fields (apply-country-defaults.test.ts).
  it.each([
    ["saved upper-cased and trimmed", " ms1 ", "MS1"],
    ["saved at the 2-character minimum", "AB", "AB"],
    ["saved at the 6-character maximum", "ABC123", "ABC123"],
    ["skipped when empty", "", null],
    ["skipped when only spaces", "   ", null],
  ])("the short code is %s", async (_case, posted, stored) => {
    const workspaceId = await signInToNewWorkspace("owner");
    await expect(
      completeOnboarding(null, form({ expectedVersion: "1", country: "MY", taxRegistered: "no", shortCode: posted })),
    ).rejects.toMatchObject({ url: "/" });
    expect(await settings(workspaceId)).toMatchObject({ country: "MY", short_code: stored });
  });

  it("a form without the short code field leaves it unset, as before", async () => {
    const workspaceId = await signInToNewWorkspace("owner");
    await expect(completeOnboarding(null, form({ expectedVersion: "1", country: "SG", taxRegistered: "no" }))).rejects.toMatchObject({
      url: "/",
    });
    expect(await settings(workspaceId)).toMatchObject({ country: "SG", short_code: null });
  });

  it.each(["A", "ABCDEFG", "AB-1", "AB C", "ÄB", "AB\u200B"])(
    "the short code %j is refused as INVALID_INPUT, echoed as typed, and nothing is written",
    async (shortCode) => {
      const workspaceId = await signInToNewWorkspace("owner");
      expect(await completeOnboarding(null, form({ expectedVersion: "1", country: "MY", taxRegistered: "no", shortCode }))).toEqual({
        ok: false,
        status: "INVALID_INPUT",
        fields: ["shortCode"],
        echo: { taxRegistered: "no", shortCode },
      });
      expect(await settings(workspaceId)).toMatchObject({ country: null, short_code: null });
    },
  );

  it("two workspaces may use the same short code (unique per workspace only, plan Q21)", async () => {
    const onboard = (shortCode: string) => completeOnboarding(null, form({ expectedVersion: "1", country: "MY", taxRegistered: "no", shortCode }));
    const first = await signInToNewWorkspace("owner");
    await expect(onboard("SAME")).rejects.toMatchObject({ url: "/" });
    const second = await signInToNewWorkspace("owner");
    await expect(onboard("same")).rejects.toMatchObject({ url: "/" });
    expect((await settings(first)).short_code).toBe("SAME");
    expect((await settings(second)).short_code).toBe("SAME");
  });

  it("a second onboarding is refused with STALE_VERSION and changes nothing", async () => {
    const workspaceId = await signInToNewWorkspace("owner");
    await expect(completeOnboarding(null, form({ expectedVersion: "1", country: "MY", taxRegistered: "no" }))).rejects.toMatchObject({
      url: "/",
    });
    expect(await completeOnboarding(null, form({ expectedVersion: "2", country: "SG", taxRegistered: "no" }))).toEqual({
      ok: false,
      status: "STALE_VERSION",
    });
    expect((await settings(workspaceId)).country).toBe("MY");
  });
});
