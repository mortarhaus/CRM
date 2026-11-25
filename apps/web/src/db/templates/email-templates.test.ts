import { randomUUID } from "node:crypto";
import { EMAIL_TEMPLATE_DEFAULTS } from "@crm/core/templates";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";
import { getEmailTemplate, saveEmailTemplate, StaleTemplateError } from "./email-templates";

// Phase 2 plan Task 23: reading and saving a workspace's template as crm_app. A workspace has no row until it saves
// an event; the default shows until then (version 0).
let database: TestDatabase;
let admin: postgres.Sql;
let app: DbHandle;
let actor: string;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  app = createDb(database.appUrl, { max: 1 });
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Admin', ${`admin-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  actor = user.id;
});

afterAll(async () => {
  await app?.sql.end();
  await admin?.end();
  await database?.stop();
});

async function newWorkspace(): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('templates', ${`templates-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  return org.id;
}

const rowsOf = async (workspaceId: string) =>
  [...(await admin`select event, subject, body, version from email_template where workspace_id = ${workspaceId}`)];
const auditOf = async (workspaceId: string) =>
  [...(await admin`select action, before, after from audit_log where workspace_id = ${workspaceId} order by created_at`)];

const DEFAULT = EMAIL_TEMPLATE_DEFAULTS.payment_details_changed;
const EDITED = { subject: "Bank details changed on {{workspace_name}}", body: "Hi {{owner_name}}, {{what_changed}} changed." };

describe("email templates, as crm_app", () => {
  it("shows the default until the first save, then the saved text, audited before and after", async () => {
    const workspaceId = await newWorkspace();
    const inWorkspace = <T>(fn: Parameters<typeof runInWorkspace<T>>[2]) => runInWorkspace(app.db, workspaceId, fn);
    expect(await inWorkspace((tx) => getEmailTemplate(tx, "payment_details_changed"))).toEqual({
      event: "payment_details_changed",
      ...{ subject: DEFAULT.subject, body: DEFAULT.body },
      version: 0,
      isDefault: true,
    });

    const saved = await inWorkspace((tx) => saveEmailTemplate(tx, "payment_details_changed", EDITED, 0, actor));
    expect(saved).toEqual({ event: "payment_details_changed", ...EDITED, version: 1, isDefault: false });
    expect(await rowsOf(workspaceId)).toEqual([{ event: "payment_details_changed", ...EDITED, version: 1 }]);
    await expect(inWorkspace((tx) => saveEmailTemplate(tx, "payment_details_changed", EDITED, 0, actor))).rejects.toThrow(StaleTemplateError);

    // Unchanged: nothing written. Restore: the default text, audited as restored.
    await inWorkspace((tx) => saveEmailTemplate(tx, "payment_details_changed", EDITED, 1, actor));
    const restored = await inWorkspace((tx) =>
      saveEmailTemplate(tx, "payment_details_changed", { subject: DEFAULT.subject, body: DEFAULT.body }, 1, actor),
    );
    expect(restored).toMatchObject({ version: 2, isDefault: true });
    expect(await auditOf(workspaceId)).toEqual([
      {
        action: "email_template.updated",
        before: { event: "payment_details_changed", subject: DEFAULT.subject, body: DEFAULT.body, version: 0 },
        after: { event: "payment_details_changed", ...EDITED, version: 1 },
      },
      {
        action: "email_template.restored",
        before: { event: "payment_details_changed", ...EDITED, version: 1 },
        after: { event: "payment_details_changed", subject: DEFAULT.subject, body: DEFAULT.body, version: 2 },
      },
    ]);
  });

  it("never reads another workspace's row", async () => {
    const [one, two] = [await newWorkspace(), await newWorkspace()];
    await runInWorkspace(app.db, one, (tx) => saveEmailTemplate(tx, "invoice_sent", { subject: "One", body: "One" }, 0, actor));
    expect(await runInWorkspace(app.db, two, (tx) => getEmailTemplate(tx, "invoice_sent"))).toMatchObject({ version: 0, isDefault: true });
  });
});
