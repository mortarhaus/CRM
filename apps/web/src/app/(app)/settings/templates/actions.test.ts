import { randomUUID } from "node:crypto";
import { EMAIL_TEMPLATE_DEFAULTS } from "@crm/core/templates";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// Phase 2 plan Task 25: the email template action through action() on the real crm_app role.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const { saveEmailTemplateAction } = await import("./actions");

let database: TestDatabase;
let admin: postgres.Sql;

async function newWorkspace(): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('templates', ${`templates-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  await admin`insert into workspace_settings (workspace_id, country, default_currency) values (${org.id}, 'MY', 'MYR')`;
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

// The signed-in user also becomes a member of another workspace, and the session's active workspace moves there.
async function joinAndSwitch(userId: string, workspaceId: string, role: string): Promise<void> {
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${userId}, ${role}, now())`;
  signedIn = { userId, workspaceId };
}

const formFor = (workspaceId: string, expectedVersion: number, intent: "save" | "restore", text = edited) => {
  const form = new FormData();
  form.set("workspaceId", workspaceId);
  form.set("event", text.event);
  form.set("expectedVersion", String(expectedVersion));
  form.set("intent", intent);
  form.set("subject", text.subject);
  form.set("body", text.body);
  return form;
};

const rowsOf = async (workspaceId: string) =>
  [...(await admin`select event, subject, body, version from email_template where workspace_id = ${workspaceId}`)];
const auditOf = async (workspaceId: string) =>
  [...(await admin`select action, actor_user_id, before, after from audit_log where workspace_id = ${workspaceId} order by created_at`)];

const DEFAULT = EMAIL_TEMPLATE_DEFAULTS.invoice_sent;
const edited = { event: "invoice_sent", subject: "Your invoice {{invoice_number}}", body: "Hi {{client_name}},\r\n\r\nPay here: {{invoice_link}}" };

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

describe("saveEmailTemplateAction", () => {
  it.each(["owner", "admin"])("%s: the first save creates the row, audited with the default before", async (role) => {
    const workspaceId = await newWorkspace();
    const actor = await signInAs(workspaceId, role);
    const result = await saveEmailTemplateAction({ ...edited, workspaceId, expectedVersion: 0 });
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: 1, isDefault: false } });
    // CRLF is stored as LF.
    const body = "Hi {{client_name}},\n\nPay here: {{invoice_link}}";
    expect(await rowsOf(workspaceId)).toEqual([{ event: "invoice_sent", subject: edited.subject, body, version: 1 }]);
    expect(await auditOf(workspaceId)).toEqual([
      {
        action: "email_template.updated",
        actor_user_id: actor,
        // The change, not the text (PR 8a Review R1).
        before: { event: "invoice_sent", version: 0, isDefault: true },
        after: { event: "invoice_sent", version: 1, isDefault: false, changed: ["subject", "body"] },
      },
    ]);
  });

  it("refuses Staff", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "staff");
    expect(await saveEmailTemplateAction({ ...edited, workspaceId, expectedVersion: 0 })).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(await rowsOf(workspaceId)).toEqual([]);
  });

  it.each([
    ["an unknown field in the body", { body: "Hi {{client_name}} {{password}}" }, ["body"]],
    ["a field of another event", { subject: "Quote {{quote_number}}" }, ["subject"]],
    ["a malformed field", { body: "Hi {{Client Name}}" }, ["body"]],
    ["an unclosed field in the body", { body: "Hi {{client_name" }, ["body"]],
    ["a nested field in the subject", { subject: "{{x {{invoice_number}} }}" }, ["subject"]],
    ["a line break in the subject", { subject: "Invoice\r\nBcc: x@example.test" }, ["subject"]],
    ["an empty body", { body: "  " }, ["body"]],
    ["an unknown event", { event: "invoice_paid" }, ["event"]],
    ["a too long subject", { subject: "x".repeat(201) }, ["subject"]],
  ])("refuses %s, writing nothing", async (_, change, fields) => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "admin");
    const result = await saveEmailTemplateAction({ ...edited, workspaceId, ...change, expectedVersion: 0 });
    expect(result).toMatchObject({ ok: false, status: "INVALID_INPUT", fields });
    expect(await rowsOf(workspaceId)).toEqual([]);
  });

  // PR 76 Review R1 P1: a refusal returns field paths only, never the posted text (which can hold personal data).
  it("refuses an invalid subject and body posted as a form with field errors and none of the posted text", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "admin");
    const address = `aisha.private-${randomUUID()}@example.test`;
    const text = { event: "invoice_sent", subject: `Call ${address} {{nope}}`, body: `Direct line ${address} {{client_name` };
    const result = await saveEmailTemplateAction(null, formFor(workspaceId, 0, "save", text));
    expect(result).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["subject", "body"] });
    expect(JSON.stringify(result)).not.toContain(address);
    expect(JSON.stringify(result)).not.toContain("Direct line");
    expect(await rowsOf(workspaceId)).toEqual([]);
  });

  it("refuses a stale version; restoring the default writes the default text, audited as restored", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "owner");
    await saveEmailTemplateAction({ ...edited, workspaceId, expectedVersion: 0 });
    expect(await saveEmailTemplateAction({ ...edited, workspaceId, subject: "Again", expectedVersion: 0 })).toEqual({ ok: false, status: "STALE_VERSION" });

    const form = new FormData();
    form.set("workspaceId", workspaceId);
    form.set("event", "invoice_sent");
    form.set("expectedVersion", "1");
    form.set("intent", "restore");
    form.set("subject", "ignored {{nope}}");
    form.set("body", "ignored");
    expect(await saveEmailTemplateAction(null, form)).toEqual({ ok: true, status: "DONE", data: { version: 2, isDefault: true } });
    expect(await rowsOf(workspaceId)).toEqual([{ event: "invoice_sent", subject: DEFAULT.subject, body: DEFAULT.body, version: 2 }]);
    expect((await auditOf(workspaceId)).map((entry) => entry.action)).toEqual(["email_template.updated", "email_template.restored"]);
  });

  it("writes nothing for an unchanged save", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "admin");
    const result = await saveEmailTemplateAction({ workspaceId, event: "quote_sent", subject: EMAIL_TEMPLATE_DEFAULTS.quote_sent.subject, body: EMAIL_TEMPLATE_DEFAULTS.quote_sent.body, expectedVersion: 0 });
    expect(result).toEqual({ ok: true, status: "DONE", data: { version: 0, isDefault: true } });
    expect(await rowsOf(workspaceId)).toEqual([]);
    expect(await auditOf(workspaceId)).toEqual([]);
  });

  it("the database refuses a line break in the subject whoever writes", async () => {
    const workspaceId = await newWorkspace();
    await expect(
      admin`insert into email_template (workspace_id, event, subject, body) values (${workspaceId}, 'invoice_sent', ${"A\nB"}, 'x')`,
    ).rejects.toMatchObject({ code: "23514", constraint_name: "email_template_subject_line_check" });
  });

  // PR 76 Review R1 P0: a form rendered in workspace A, posted after the session switched to workspace B.
  describe("a form rendered for another workspace", () => {
    it("is refused at version 0 (neither workspace has saved the template), and neither workspace changes", async () => {
      const first = await newWorkspace();
      const second = await newWorkspace();
      const userId = await signInAs(first, "owner");
      await joinAndSwitch(userId, second, "owner");
      expect(await saveEmailTemplateAction(null, formFor(first, 0, "save"))).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
      expect(await saveEmailTemplateAction(null, formFor(first, 0, "restore"))).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
      for (const workspaceId of [first, second]) {
        expect(await rowsOf(workspaceId)).toEqual([]);
        expect(await auditOf(workspaceId)).toEqual([]);
      }
    });

    it("is refused when both workspaces are at the same saved version, and neither row or audit history changes", async () => {
      const first = await newWorkspace();
      const second = await newWorkspace();
      const userId = await signInAs(first, "admin");
      const own = { ...edited, subject: "First {{invoice_number}}" };
      expect(await saveEmailTemplateAction(null, formFor(first, 0, "save", own))).toMatchObject({ ok: true, data: { version: 1 } });
      await joinAndSwitch(userId, second, "admin");
      expect(await saveEmailTemplateAction(null, formFor(second, 0, "save"))).toMatchObject({ ok: true, data: { version: 1 } });
      const before = { first: [await rowsOf(first), await auditOf(first)], second: [await rowsOf(second), await auditOf(second)] };

      // The session is in the second workspace; the form was rendered for the first, at the matching version 1.
      const stale = { ...edited, subject: "Leaked {{invoice_number}}" };
      expect(await saveEmailTemplateAction(null, formFor(first, 1, "save", stale))).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
      expect(await saveEmailTemplateAction(null, formFor(first, 1, "restore"))).toEqual({ ok: false, status: "WORKSPACE_CHANGED" });
      expect({ first: [await rowsOf(first), await auditOf(first)], second: [await rowsOf(second), await auditOf(second)] }).toEqual(before);
    });

    it("saves and restores in the workspace it was rendered for", async () => {
      const first = await newWorkspace();
      const second = await newWorkspace();
      const userId = await signInAs(second, "owner");
      await joinAndSwitch(userId, first, "owner");
      expect(await saveEmailTemplateAction(null, formFor(first, 0, "save"))).toEqual({ ok: true, status: "DONE", data: { version: 1, isDefault: false } });
      expect(await saveEmailTemplateAction(null, formFor(first, 1, "restore"))).toEqual({ ok: true, status: "DONE", data: { version: 2, isDefault: true } });
      expect(await rowsOf(first)).toEqual([{ event: "invoice_sent", subject: DEFAULT.subject, body: DEFAULT.body, version: 2 }]);
      expect((await auditOf(first)).map((entry) => entry.action)).toEqual(["email_template.updated", "email_template.restored"]);
      expect(await rowsOf(second)).toEqual([]);
      expect(await auditOf(second)).toEqual([]);
    });
  });
});
