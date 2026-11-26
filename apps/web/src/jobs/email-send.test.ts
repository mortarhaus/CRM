import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import postgres from "postgres";
import { TEST_EMAIL_USER_LIMIT, TEST_EMAIL_WORKSPACE_LIMIT } from "@crm/core/security";
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
import { rendered } from "../test/rendered";

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

const email = await import("../app/(app)/settings/email/actions");
const sendTestEmail = rendered(email.sendTestEmail, () => signedIn?.workspaceId);

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

async function newWorkspace(name: string): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values (${name}, ${`${name}-${crypto.randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  return org.id;
}

async function newMember(role: string, inWorkspace = workspaceId): Promise<{ id: string; email: string }> {
  const created = await newUser();
  await admin`
    insert into member (organization_id, user_id, role, created_at) values (${inWorkspace}, ${created.id}, ${role}, now())`;
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

async function auditRows(userId: string, inWorkspace = workspaceId) {
  return admin<{ action: string; actor_user_id: string | null; target_type: string; target_id: string }[]>`
    select action, actor_user_id, target_type, target_id, before, after, ip from audit_log
     where workspace_id = ${inWorkspace} and target_id = ${userId} order by created_at, action`;
}

// The test email's counters (review P2-1): keyed by IDs, read with the admin connection.
const userKey = (userId: string) => `email-test:user:${userId}`;
const workspaceKey = (id: string) => `email-test:ws:${id}`;

async function unitsSpent(key: string): Promise<number> {
  const [row] = await admin<{ count: number }[]>`select count from rate_limit where key = ${key}`;
  return row?.count ?? 0;
}

async function jobsFor(userId: string): Promise<number> {
  return (await admin`select id from pgboss.job_common where name = 'email.send' and data->>'userId' = ${userId}`).length;
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
  workspaceId = await newWorkspace("email");
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
  const limiter = globalThis as typeof globalThis & { crmLimiterDb?: { sql: { end(): Promise<void> } } };
  await limiter.crmLimiterDb?.sql.end();
  limiter.crmLimiterDb = undefined;
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
    expect(await unitsSpent(userKey(member.id))).toBe(1);
  });
});

describe("the email.send handler (worker)", () => {
  // Review P3-2: one job per call, so a failed send never retries an email already sent in the same batch.
  it("refuses a batch of more than one job and sends nothing", async () => {
    const send = vi.fn();
    const handler = emailSendHandler(() => ({ send }) as unknown as ReturnType<typeof createEmailAdapter>);
    const member = await newMember("owner");
    const job = { id: crypto.randomUUID(), name: "email.send", data: { workspaceId, userId: member.id } };
    await expect(handler([job, { ...job, id: crypto.randomUUID() }] as never, { log: () => {} })).rejects.toThrow(
      "email.send handles one job per call",
    );
    expect(send).not.toHaveBeenCalled();
  });

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

// Review P2-1 (2026-11-01): sign-up does not verify the address, so the test email is limited per user and per
// workspace on the database counters (src/db/system/rate-limit.ts). Each case has its own workspace.

describe("sendTestEmail: rate limits (review P2-1)", () => {
  it(`answers RATE_LIMITED to post ${TEST_EMAIL_USER_LIMIT.max + 1} in the hour and enqueues no job for it`, async () => {
    const own = await newWorkspace("limit-user");
    const member = await newMember("owner", own);
    signedIn = { userId: member.id, workspaceId: own };
    for (let i = 0; i < TEST_EMAIL_USER_LIMIT.max; i += 1) {
      expect(await sendTestEmail({}, crypto.randomUUID())).toEqual({ ok: true, status: "DONE", data: { queued: true } });
    }
    expect(await sendTestEmail({}, crypto.randomUUID())).toEqual({ ok: false, status: "RATE_LIMITED" });
    expect(await jobsFor(member.id)).toBe(TEST_EMAIL_USER_LIMIT.max);
    expect(await auditRows(member.id, own).then((rows) => rows.filter((row) => row.action === "email.test_requested"))).toHaveLength(
      TEST_EMAIL_USER_LIMIT.max,
    );
    // The keys hold IDs only, never the address (UNI-09).
    expect(await admin`select key from rate_limit where key like ${"%@%"}`).toEqual([]);
    // Wait for the sends, so no message of this case lands while a later case counts messages.
    await waitFor("messages in Mailpit", async () =>
      (await searchMessages(member.email, mailpitUrl)).length === TEST_EMAIL_USER_LIMIT.max ? true : undefined,
    );
  });

  it("does not count a FORBIDDEN or unauthenticated post", async () => {
    const own = await newWorkspace("limit-staff");
    const member = await newMember("staff", own);
    signedIn = { userId: member.id, workspaceId: own };
    for (let i = 0; i <= TEST_EMAIL_USER_LIMIT.max; i += 1) {
      expect(await sendTestEmail({}, crypto.randomUUID())).toEqual({ ok: false, status: "FORBIDDEN" });
    }
    signedIn = null;
    expect(await sendTestEmail({}, crypto.randomUUID())).toEqual({ ok: false, status: "UNAUTHENTICATED" });
    expect(await unitsSpent(userKey(member.id))).toBe(0);
    expect(await unitsSpent(workspaceKey(own))).toBe(0);
  });

  it(`answers RATE_LIMITED once the workspace has sent ${TEST_EMAIL_WORKSPACE_LIMIT.max} in the hour, and gives the user's unit back`, async () => {
    const own = await newWorkspace("limit-workspace");
    const member = await newMember("admin", own);
    // The workspace's window already holds its maximum (as if other members had sent them).
    await admin`
      insert into rate_limit (key, count, window_start, window_seconds)
      values (${workspaceKey(own)}, ${TEST_EMAIL_WORKSPACE_LIMIT.max}, now(), ${TEST_EMAIL_WORKSPACE_LIMIT.windowSeconds})`;
    signedIn = { userId: member.id, workspaceId: own };
    expect(await sendTestEmail({}, crypto.randomUUID())).toEqual({ ok: false, status: "RATE_LIMITED" });
    expect(await jobsFor(member.id)).toBe(0);
    expect(await auditRows(member.id, own)).toEqual([]);
    expect(await unitsSpent(userKey(member.id))).toBe(0);
  });
});
