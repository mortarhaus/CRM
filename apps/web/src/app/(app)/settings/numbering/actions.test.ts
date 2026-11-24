import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// Phase 2 plan Task 19: the numbering action through action() on the real crm_app role.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const { updateNumberingSettings } = await import("./actions");

let database: TestDatabase;
let admin: postgres.Sql;

async function newWorkspace(onboarded = true): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('numbering', ${`numbering-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  if (onboarded) await admin`insert into workspace_settings (workspace_id, country, timezone) values (${org.id}, 'MY', 'Asia/Kuala_Lumpur')`;
  else await admin`insert into workspace_settings (workspace_id) values (${org.id})`;
  return org.id;
}

async function signInAs(workspaceId: string, role: string): Promise<string> {
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${user.id}, ${role}, now())`;
  signedIn = { userId: user.id, workspaceId };
  return user.id;
}

const sequenceOf = async (workspaceId: string) =>
  [...(await admin`select pattern, reset_rule, counter, version from doc_sequence where workspace_id = ${workspaceId}`)];
const auditOf = async (workspaceId: string) =>
  [...(await admin`select action, actor_user_id, before, after from audit_log where workspace_id = ${workspaceId} order by action`)];

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

describe("updateNumberingSettings", () => {
  it.each(["owner", "admin"])("%s: saves the pattern and rule, audited with before and after", async (role) => {
    const workspaceId = await newWorkspace();
    const actor = await signInAs(workspaceId, role);
    // A workspace onboarded before the counter existed gets the country default first (version 1).
    expect(
      await updateNumberingSettings({ expectedVersion: 1, pattern: " Q-{YY}{MM}-{SEQ:3} ", resetRule: "monthly" }),
    ).toEqual({ ok: true, status: "DONE", data: { version: 2 } });
    expect(await sequenceOf(workspaceId)).toEqual([{ pattern: "Q-{YY}{MM}-{SEQ:3}", reset_rule: "monthly", counter: 0, version: 2 }]);
    expect(await auditOf(workspaceId)).toEqual([
      {
        action: "doc_sequence.created",
        actor_user_id: actor,
        before: null,
        after: { doc_type: "invoice", pattern: "INV-{CODE}-{YYYY}-{SEQ:4}", reset_rule: "yearly", version: 1 },
      },
      {
        action: "doc_sequence.updated",
        actor_user_id: actor,
        before: { doc_type: "invoice", pattern: "INV-{CODE}-{YYYY}-{SEQ:4}", reset_rule: "yearly", version: 1 },
        after: { doc_type: "invoice", pattern: "Q-{YY}{MM}-{SEQ:3}", reset_rule: "monthly", version: 2 },
      },
    ]);
  });

  it("refuses Staff with FORBIDDEN and creates or changes nothing", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "staff");
    expect(await updateNumberingSettings({ expectedVersion: 1, pattern: "X-{SEQ:4}", resetRule: "never" })).toEqual({
      ok: false,
      status: "FORBIDDEN",
    });
    expect(await sequenceOf(workspaceId)).toEqual([]);
    expect(await auditOf(workspaceId)).toEqual([]);
  });

  it.each([
    ["an unknown token", { pattern: "INV-{DD}-{SEQ:4}", resetRule: "never" }, ["pattern"]],
    ["no counter", { pattern: "INV-{YYYY}", resetRule: "yearly" }, ["pattern"]],
    ["a yearly reset without the year", { pattern: "INV-{SEQ:4}", resetRule: "yearly" }, ["pattern"]],
    ["an unknown reset rule", { pattern: "INV-{SEQ:4}", resetRule: "weekly" }, ["resetRule"]],
  ])("refuses %s with INVALID_INPUT and writes nothing", async (_, fields, paths) => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "owner");
    expect(await updateNumberingSettings({ expectedVersion: 1, ...fields })).toEqual({ ok: false, status: "INVALID_INPUT", fields: paths });
    expect(await sequenceOf(workspaceId)).toEqual([]);
  });

  it("refuses a stale version with STALE_VERSION and keeps the stored pattern", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "admin");
    await updateNumberingSettings({ expectedVersion: 1, pattern: "A-{YYYY}-{SEQ:4}", resetRule: "yearly" });
    expect(await updateNumberingSettings({ expectedVersion: 1, pattern: "B-{YYYY}-{SEQ:4}", resetRule: "yearly" })).toEqual({
      ok: false,
      status: "STALE_VERSION",
    });
    expect(await sequenceOf(workspaceId)).toMatchObject([{ pattern: "A-{YYYY}-{SEQ:4}", version: 2 }]);
  });

  // Bob PR #72 R1 P1: the stored period is later than the workspace's "now" (as after a time zone change to one
  // further west at a year boundary); a reset-rule change would restart the counter, so it is refused.
  it("refuses a reset-rule change before the stored period has started with PERIOD_BEHIND and writes nothing", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "owner");
    await admin`insert into doc_sequence (workspace_id, doc_type, pattern, reset_rule, counter, last_reset_period)
      values (${workspaceId}, 'invoice', 'INV-{YYYY}{MM}-{SEQ:4}', 'yearly', 3, '2999')`;
    expect(await updateNumberingSettings({ expectedVersion: 1, pattern: "INV-{YYYY}{MM}-{SEQ:4}", resetRule: "monthly" })).toEqual({
      ok: false,
      status: "PERIOD_BEHIND",
    });
    expect(await sequenceOf(workspaceId)).toEqual([{ pattern: "INV-{YYYY}{MM}-{SEQ:4}", reset_rule: "yearly", counter: 3, version: 1 }]);
    expect(await auditOf(workspaceId)).toEqual([]);
    // A pattern change alone restarts nothing, so it is saved.
    expect(await updateNumberingSettings({ expectedVersion: 1, pattern: "Q-{YYYY}{MM}-{SEQ:4}", resetRule: "yearly" })).toMatchObject({ ok: true });
  });

  it("refuses a workspace not yet onboarded with NOT_ONBOARDED", async () => {
    const workspaceId = await newWorkspace(false);
    await signInAs(workspaceId, "owner");
    expect(await updateNumberingSettings({ expectedVersion: 1, pattern: "A-{SEQ:4}", resetRule: "never" })).toEqual({
      ok: false,
      status: "NOT_ONBOARDED",
    });
    expect(await sequenceOf(workspaceId)).toEqual([]);
  });
});
