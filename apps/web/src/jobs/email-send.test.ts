import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createEmailAdapter } from "../adapters/email";
import { openDatabase } from "../db/system";
import { withWorkspace } from "../db/workspace";
import { TEST_EMAIL_SUBJECT } from "../emails/test-email";
import { MAILPIT_IMAGE, searchMessages } from "../test/mailpit";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { startWorker, type WorkerHandle } from "../worker/start";
import { getSendBoss } from "./boss";
import { emailSendHandler } from "./email-send";
import { enqueueJob } from "./enqueue";

// Plan Task 27 Steps 1-2: the settings action enqueues email.send with IDs only, and the worker's handler sends the
// test email to the member's own address through the SMTP adapter into a real Mailpit.

let databaseUrl = "";
vi.mock("../lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));

// The signed-in user and their active workspace, as action() reads them through getCurrentSession().
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("../lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const { sendTestEmail } = await import("../app/(app)/settings/email/actions");

const FROM = "CRM Test <crm@mail.example.test>";

let database: TestDatabase;
let admin: postgres.Sql;
let mailpit: StartedTestContainer;
let mailpitUrl = "";
let worker: WorkerHandle;
let workspaceId = "";
const logLines: string[] = [];
let counter = 0;

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

async function newUser(): Promise<{ id: string; email: string }> {
  counter += 1;
  const email = `member-${counter}-${Date.now()}@client.example.test`;
  const [row] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values (${`Member ${counter}`}, ${email}) returning id`;
  if (!row) throw new Error("user not created");
  return { id: row.id, email };
}

async function newMember(role: string): Promise<{ id: string; email: string }> {
  const created = await newUser();
  await admin`
    insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${created.id}, ${role}, now())`;
  return created;
}

async function jobState(id: string): Promise<string | undefined> {
  const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${id}`;
  return row?.state;
}

async function messageCount(): Promise<number> {
  const response = await fetch(`${mailpitUrl}/api/v1/messages`);
  return ((await response.json()) as { messages_count: number }).messages_count;
}

async function auditRows(userId: string) {
  return admin<{ action: string; actor_user_id: string | null; target_type: string; target_id: string }[]>`
    select action, actor_user_id, target_type, target_id, before, after, ip from audit_log
     where workspace_id = ${workspaceId} and target_id = ${userId} order by created_at, action`;
}

// A refused job is retried (email.send: retryLimit 5, then email.send.dead), so it is seen in `retry` first.
async function waitForFailure(id: string): Promise<void> {
  await waitFor("job failed", async () => (["retry", "failed"].includes((await jobState(id)) ?? "") ? true : undefined));
}

beforeAll(async () => {
  [database, mailpit] = await Promise.all([
    startDatabase(),
    new GenericContainer(MAILPIT_IMAGE).withExposedPorts(1025, 8025).withWaitStrategy(Wait.forHttp("/readyz", 8025)).start(),
  ]);
  databaseUrl = database.appUrl;
  mailpitUrl = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`;
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('email', ${`email-${crypto.randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  workspaceId = org.id;
  const adapter = createEmailAdapter({
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: FROM,
    SMTP_URL: `smtp://${mailpit.getHost()}:${mailpit.getMappedPort(1025)}`,
  });
  const appDb = openDatabase(database.appUrl, { max: 4 });
  worker = await startWorker({
    appDb,
    workerUrl: database.workerUrl,
    log: (line) => logLines.push(line),
    handlers: { "email.send": emailSendHandler(() => adapter) },
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

describe("sendTestEmail: Admin and Owner only, job data IDs only (AUTH-03, PROJECT.md §9)", () => {
  it.each(["owner", "admin"])("%s: one job with data exactly { workspaceId, userId }, one message to their address", async (role) => {
    const member = await newMember(role);
    signedIn = { userId: member.id, workspaceId };

    const result = await sendTestEmail({}, crypto.randomUUID());
    expect(result).toEqual({ ok: true, status: "DONE", data: { queued: true } });

    const [job] = await admin<{ id: string; data: Record<string, unknown> }[]>`
      select id, data from pgboss.job_common where name = 'email.send' and data->>'userId' = ${member.id}`;
    expect(Object.keys(job?.data ?? {}).sort()).toEqual(["userId", "workspaceId"]);
    expect(job?.data).toEqual({ workspaceId, userId: member.id });

    const messages = await waitFor("message in Mailpit", async () => {
      const found = await searchMessages(member.email, mailpitUrl);
      return found.length > 0 ? found : undefined;
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.Subject).toBe(TEST_EMAIL_SUBJECT);
    expect(messages[0]?.To.map((to) => to.Address)).toEqual([member.email]);
    await waitFor("job completed", async () => ((await jobState(job?.id ?? "")) === "completed" ? true : undefined));

    // One row when asked, one when sent; neither holds the address (UNI-09).
    const rows = await auditRows(member.id);
    expect(rows.map(({ action, actor_user_id, target_type }) => ({ action, actor_user_id, target_type }))).toEqual([
      { action: "email.test_requested", actor_user_id: member.id, target_type: "user" },
      { action: "email.test_sent", actor_user_id: null, target_type: "user" },
    ]);
    expect(JSON.stringify(rows)).not.toContain(member.email);
    expect(logLines.join("\n")).not.toContain(member.email);
  });

  it("refuses Staff with FORBIDDEN and enqueues nothing", async () => {
    const member = await newMember("staff");
    signedIn = { userId: member.id, workspaceId };
    expect(await sendTestEmail({}, crypto.randomUUID())).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(await admin`select id from pgboss.job_common where data->>'userId' = ${member.id}`).toEqual([]);
    expect(await auditRows(member.id)).toEqual([]);
  });

  it("answers a repeated key with the stored result and enqueues one job", async () => {
    const member = await newMember("owner");
    signedIn = { userId: member.id, workspaceId };
    const key = crypto.randomUUID();
    expect(await sendTestEmail({}, key)).toEqual({ ok: true, status: "DONE", data: { queued: true } });
    expect(await sendTestEmail({}, key)).toEqual({ ok: true, status: "REPLAYED", data: { queued: true } });
    expect(await admin`select id from pgboss.job_common where data->>'userId' = ${member.id}`).toHaveLength(1);
  });
});

describe("the email.send handler (worker)", () => {
  it("ignores unknown job data fields (EVT-03)", async () => {
    const member = await newMember("owner");
    const boss = await getSendBoss();
    const id = await boss.send("email.send", { workspaceId, userId: member.id, addedLater: "x" });
    await waitFor("job completed", async () => ((await jobState(id ?? "")) === "completed" ? true : undefined));
    expect(await searchMessages(member.email, mailpitUrl)).toHaveLength(1);
  });

  it("fails the job and sends nothing to a user who is no longer a member", async () => {
    const member = await newMember("owner");
    await admin`delete from member where user_id = ${member.id}`;
    const before = await messageCount();
    const id = await withWorkspace(workspaceId, (tx) => enqueueJob(tx, "email.send", { workspaceId, userId: member.id }));
    await waitForFailure(id ?? "");
    expect(await messageCount()).toBe(before);
    expect(await auditRows(member.id)).toEqual([]);
  });

  it("fails the job and sends nothing when userId is not a uuid", async () => {
    const before = await messageCount();
    const boss = await getSendBoss();
    const id = await boss.send("email.send", { workspaceId, userId: "member@client.example.test" });
    await waitForFailure(id ?? "");
    const [row] = await admin<{ output: { message?: string } | null }[]>`select output from pgboss.job_common where id = ${id ?? ""}`;
    expect(JSON.stringify(row?.output)).not.toContain("member@client.example.test");
    expect(await messageCount()).toBe(before);
  });
});
