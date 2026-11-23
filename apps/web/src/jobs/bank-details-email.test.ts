import { randomUUID } from "node:crypto";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createEmailAdapter, type EmailAdapter } from "../adapters/email";
import { openDatabase } from "../db/system";
import { withWorkspace } from "../db/workspace";
import { MAILPIT_IMAGE, searchMessages } from "../test/mailpit";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { startWorker, type WorkerHandle } from "../worker/start";
import { bankDetailsEmailHandler } from "./bank-details-email";
import { enqueueJob, stableJobId } from "./enqueue";

// Plan Task 16: the owner email on a bank-details or QR change. The action's side (one job per Owner in the change's
// transaction) is tested in settings/payment/actions.test.ts; here the worker's handler sends through the SMTP adapter
// into a real Mailpit, from jobs enqueued as the action enqueues them.

let databaseUrl = "";
vi.mock("../lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));

const QUEUE = "email.bank_details_changed";
const ACCOUNT_NUMBER = "5140123456789";

let database: TestDatabase;
let admin: postgres.Sql;
let mailpit: StartedTestContainer;
let mailpitUrl = "";
let worker: WorkerHandle;
const logLines: string[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(what: string, check: () => Promise<T | undefined>, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(200);
  }
}

async function newWorkspace(name: string, settings: { timezone: string; dateFormat: string; country: string }): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values (${name}, ${`ws-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  await admin`
    insert into workspace_settings (workspace_id, country, timezone, date_format, bank_name, bank_account_holder, bank_account_number)
    values (${org.id}, ${settings.country}, ${settings.timezone}, ${settings.dateFormat}, 'Maybank', 'Studio Holder', ${ACCOUNT_NUMBER})`;
  return org.id;
}

async function newMember(workspaceId: string, role: string, name: string): Promise<{ id: string; email: string }> {
  const email = `${role}-${randomUUID()}@client.example.test`;
  const [row] = await admin<{ id: string }[]>`insert into "user" (name, email) values (${name}, ${email}) returning id`;
  if (!row) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${row.id}, ${role}, now())`;
  return { id: row.id, email };
}

// An audit entry as updateSettings writes it for a bank or QR change, at a fixed time.
async function newChange(workspaceId: string, actorId: string, after: Record<string, unknown>, at: string): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into audit_log (workspace_id, actor_user_id, action, target_type, target_id, before, after, created_at)
    values (${workspaceId}, ${actorId}, 'workspace_settings.bank_details_updated', 'workspace_settings', ${workspaceId},
            '{}'::jsonb, ${admin.json(after as postgres.JSONValue)}, ${at})
    returning id`;
  if (!row) throw new Error("audit entry not created");
  return row.id;
}

function enqueue(workspaceId: string, changeId: string, userId: string): Promise<string | null> {
  return withWorkspace(workspaceId, (tx) =>
    enqueueJob(tx, QUEUE, { workspaceId, changeId, userId }, { id: stableJobId(changeId, userId) }),
  );
}

async function jobState(id: string): Promise<string | undefined> {
  const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${id}`;
  return row?.state;
}

const completed = (id: string) =>
  waitFor("job completed", async () => ((await jobState(id)) === "completed" ? true : undefined));

async function messageOf(to: string): Promise<{ Subject: string; Text: string; HTML: string }> {
  const [found] = await waitFor("message in Mailpit", async () => {
    const messages = await searchMessages(to, mailpitUrl);
    return messages.length > 0 ? messages : undefined;
  });
  const response = await fetch(`${mailpitUrl}/api/v1/message/${found?.ID ?? ""}`);
  return (await response.json()) as { Subject: string; Text: string; HTML: string };
}

beforeAll(async () => {
  [database, mailpit] = await Promise.all([
    startDatabase(),
    new GenericContainer(MAILPIT_IMAGE).withExposedPorts(1025, 8025).withWaitStrategy(Wait.forHttp("/readyz", 8025)).start(),
  ]);
  databaseUrl = database.appUrl;
  mailpitUrl = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`;
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  const adapter = createEmailAdapter({
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: "CRM Test <crm@mail.example.test>",
    SMTP_URL: `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`,
  });
  worker = await startWorker({
    appDb: openDatabase(database.appUrl, { max: 4 }),
    workerUrl: database.workerUrl,
    log: (line) => logLines.push(line),
    handlers: { [QUEUE]: bankDetailsEmailHandler(() => adapter) },
  });
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmSendBoss?: Promise<{ stop(): Promise<void> }> };
  await (await cache.crmSendBoss?.catch(() => undefined))?.stop();
  cache.crmSendBoss = undefined;
  await worker?.stop();
  await admin?.end();
  await Promise.all([database?.stop(), mailpit?.stop()]);
});

describe("the email.bank_details_changed handler (worker)", () => {
  it("sends the approved wording to the Owner, dated in the workspace's zone and format, with no bank value", async () => {
    const workspaceId = await newWorkspace("Studio Sdn Bhd", { country: "MY", timezone: "Asia/Kuala_Lumpur", dateFormat: "dd-mmm-yyyy" });
    const owner = await newMember(workspaceId, "owner", "Aisha");
    const actor = await newMember(workspaceId, "owner", "Ben");
    const after = { bank_name: "Maybank", bank_account_holder: "[pii]", bank_account_number: { last4: "6789" }, version: 2 };
    const changeId = await newChange(workspaceId, actor.id, after, "2026-11-23T01:15:00Z");

    const id = await enqueue(workspaceId, changeId, owner.id);
    expect(id).toBe(stableJobId(changeId, owner.id));
    await completed(id ?? "");

    const message = await messageOf(owner.email);
    expect(message.Subject).toBe("Payment details changed on Studio Sdn Bhd");
    const text = message.Text.replace(/\s+/g, " ");
    expect(text).toContain("Hi Aisha,");
    expect(text).toContain("The payment details for Studio Sdn Bhd were changed on 23-Nov-2026 09:15 (Asia/Kuala_Lumpur) by Ben.");
    expect(text).toContain("What changed: bank details.");
    for (const body of [message.Text, message.HTML]) {
      expect(body).not.toContain(ACCOUNT_NUMBER);
      expect(body).not.toContain("6789");
      expect(body).not.toContain("Maybank");
    }
  });

  it("names the QR by the workspace country, and uses the workspace's own date format", async () => {
    const workspaceId = await newWorkspace("Lion Studio", { country: "SG", timezone: "Asia/Singapore", dateFormat: "yyyy-mm-dd" });
    const owner = await newMember(workspaceId, "owner", "Chen");
    const key = `ws/${workspaceId}/duitnow/${"a".repeat(64)}.png`;
    const changeId = await newChange(workspaceId, owner.id, { duitnow_qr_key: key, version: 3 }, "2026-11-22T16:30:00Z");
    await completed((await enqueue(workspaceId, changeId, owner.id)) ?? "");

    const message = await messageOf(owner.email);
    const text = message.Text.replace(/\s+/g, " ");
    expect(text).toContain("were changed on 2026-11-23 00:30 (Asia/Singapore) by Chen.");
    expect(text).toContain("What changed: the PayNow QR.");
    expect(message.Text + message.HTML).not.toContain(key);
  });

  it("makes one job of a repeated enqueue (idempotent job id), so one email", async () => {
    const workspaceId = await newWorkspace("Once", { country: "MY", timezone: "Asia/Kuala_Lumpur", dateFormat: "dd-mmm-yyyy" });
    const owner = await newMember(workspaceId, "owner", "Dina");
    const changeId = await newChange(workspaceId, owner.id, { bank_name: "x", version: 2 }, "2026-11-23T01:00:00Z");
    const first = await enqueue(workspaceId, changeId, owner.id);
    expect(await enqueue(workspaceId, changeId, owner.id)).toBeNull();
    await completed(first ?? "");
    await sleep(3_000);
    expect(await searchMessages(owner.email, mailpitUrl)).toHaveLength(1);
  });

  it("skips a recipient who is no longer an Owner: the job completes, nothing is sent, the log names no one", async () => {
    const workspaceId = await newWorkspace("Skip", { country: "MY", timezone: "Asia/Kuala_Lumpur", dateFormat: "dd-mmm-yyyy" });
    const demoted = await newMember(workspaceId, "owner", "Eve");
    const changeId = await newChange(workspaceId, demoted.id, { bank_name: "x", version: 2 }, "2026-11-23T01:00:00Z");
    await admin`update member set "role" = 'admin' where user_id = ${demoted.id}`;
    await completed((await enqueue(workspaceId, changeId, demoted.id)) ?? "");
    expect(await searchMessages(demoted.email, mailpitUrl)).toEqual([]);
    expect(logLines).toContain(
      JSON.stringify({ level: "info", msg: "owner email skipped", queue: QUEUE, reason: "not_owner" }),
    );
    expect(logLines.join("\n")).not.toContain(demoted.email);
    expect(logLines.join("\n")).not.toContain(demoted.id);
  });

  it("fails the job (retry, then dead letter) when the change is not found, and sends nothing", async () => {
    const workspaceId = await newWorkspace("Missing", { country: "MY", timezone: "Asia/Kuala_Lumpur", dateFormat: "dd-mmm-yyyy" });
    const owner = await newMember(workspaceId, "owner", "Fai");
    const id = await enqueue(workspaceId, randomUUID(), owner.id);
    await waitFor("job failed", async () => (["retry", "failed"].includes((await jobState(id ?? "")) ?? "") ? true : undefined));
    const [row] = await admin<{ output: unknown }[]>`select output from pgboss.job_common where id = ${id ?? ""}`;
    expect(JSON.stringify(row?.output)).toContain("BankDetailsChangeNotFoundError");
    expect(await searchMessages(owner.email, mailpitUrl)).toEqual([]);
  });

  it("refuses a batch of more than one job and sends nothing", async () => {
    const send = vi.fn();
    const handler = bankDetailsEmailHandler(() => ({ send }) as unknown as EmailAdapter);
    const job = { id: randomUUID(), name: QUEUE, data: { workspaceId: randomUUID(), changeId: randomUUID(), userId: randomUUID() } };
    await expect(handler([job, { ...job, id: randomUUID() }] as never, { log: () => {} })).rejects.toThrow(
      `${QUEUE} handles one job per call`,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses job data that is not three IDs (EVT-03: extra fields are ignored)", async () => {
    const send = vi.fn();
    const handler = bankDetailsEmailHandler(() => ({ send }) as unknown as EmailAdapter);
    const job = { id: randomUUID(), name: QUEUE, data: { workspaceId: randomUUID(), userId: "owner@client.example.test" } };
    await expect(handler([job] as never, { log: () => {} })).rejects.toThrow("job data is not { workspaceId, changeId, userId }");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("stableJobId", () => {
  it("is a uuid, the same for the same IDs and different for others", () => {
    const [a, b] = [randomUUID(), randomUUID()];
    expect(stableJobId(a, b)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stableJobId(a, b)).toBe(stableJobId(a, b));
    expect(stableJobId(a, b)).not.toBe(stableJobId(b, a));
  });
});
