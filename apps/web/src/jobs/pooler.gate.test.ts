import { type Job, PgBoss } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type StartedPgBouncer, startPgBouncer } from "../test/pgbouncer";
import { permissionErrors, serverLog, startDatabase, type TestDatabase } from "../test/postgres";
import { SEND_BOSS_OPTIONS, WORKER_BOSS_OPTIONS } from "./options";

// The pooler gate (plan Task 20; spec R6): the Task 17 worker operation set with crm_worker and crm_app both
// connecting through a transaction-mode PgBouncer, and the worker running long enough for supervise, maintenance
// and monitor to complete at least one cycle each at the intervals below. Run by `pnpm test:gates`, not `pnpm test`.
// The chosen provider's own pooler run is the Stage 3 pre-cutover gate, not this test.

const SHORT_INTERVALS = {
  superviseIntervalSeconds: 1,
  maintenanceIntervalSeconds: 1,
  monitorIntervalSeconds: 1,
  queueCacheIntervalSeconds: 1,
  cronMonitorIntervalSeconds: 1,
  cronWorkerIntervalSeconds: 1,
  clockMonitorIntervalSeconds: 1,
  flowIntervalSeconds: 1,
} as const;
const POLL = { pollingIntervalSeconds: 0.5 } as const;
const MIN_WORKER_RUN_MS = 75_000;

type Scenario = "ok" | "flaky" | "dead" | "slow";
interface Data {
  scenario: Scenario;
  key: string;
}

let db: TestDatabase;
let pooler: StartedPgBouncer;
let admin: postgres.Sql;

beforeAll(async () => {
  db = await startDatabase({ serverLog: true });
  pooler = await startPgBouncer(db);
  admin = postgres(db.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await admin?.end();
  await pooler?.stop();
  await db?.stop();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(what: string, check: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(250);
  }
}

async function jobState(id: string): Promise<{ state: string; retry_count: number } | undefined> {
  const [row] = await admin<{ state: string; retry_count: number }[]>`
    select state, retry_count from pgboss.job where id = ${id}`;
  return row;
}

const stateIs = (id: string, state: string) => async () => {
  const row = await jobState(id);
  return row?.state === state ? row : undefined;
};
const gone = (id: string) => async () => ((await jobState(id)) === undefined ? true : undefined);

function emailHandler(state: { attempts: Map<string, number>; fixed: boolean }) {
  return async ([job]: Job<Data>[]) => {
    if (!job) return;
    const attempt = (state.attempts.get(job.data.key) ?? 0) + 1;
    state.attempts.set(job.data.key, attempt);
    if (job.data.scenario === "flaky" && attempt <= 2) throw new Error("flaky");
    if (job.data.scenario === "dead" && !state.fixed) throw new Error("dead");
    if (job.data.scenario === "slow") await sleep(3_000);
  };
}

// A statement crm_worker is denied, run directly just before the log is read, so an empty slice cannot pass.
const SENTINEL = "select 1 from pgboss.bam";
const SENTINEL_ERROR = `permission denied for table bam | ${SENTINEL}`;
async function runSentinel(): Promise<void> {
  const sql = postgres(db.workerUrl, { max: 1, onnotice: () => {} });
  try {
    const code = await sql.unsafe(SENTINEL).then(
      () => "allowed",
      (error: { code?: string }) => error.code,
    );
    expect(code).toBe("42501");
  } finally {
    await sql.end();
  }
}

describe("pg-boss through PgBouncer (transaction mode), crm_worker and crm_app", () => {
  it("runs the worker operation set for a full maintenance cycle with zero 42501 and zero error events", async () => {
    const before = (await serverLog(db.container)).length;
    const sender = new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString: pooler.appUrl });
    const worker = new PgBoss({ ...WORKER_BOSS_OPTIONS, ...SHORT_INTERVALS, connectionString: pooler.workerUrl });
    const errors: unknown[] = [];
    const warnings: unknown[] = [];
    sender.on("error", (error) => errors.push(error));
    worker.on("error", (error) => errors.push(error));
    worker.on("warning", (warning) => warnings.push(warning));
    const pgbouncerAddress = pooler.container.getIpAddress("bridge");

    await sender.start();
    await worker.start();
    const workerStarted = Date.now();
    const handlerState = { attempts: new Map<string, number>(), fixed: false };
    const cronRuns: string[] = [];
    let workerRanMs: number | undefined;
    try {
      await worker.work<Data>("email.send", POLL, emailHandler(handlerState));
      await worker.work("rate_limit.cleanup", POLL, async ([job]) => {
        if (job) cronRuns.push(job.id);
      });
      await worker.schedule("rate_limit.cleanup", "* * * * *");

      const send = async (scenario: Scenario, options: Parameters<PgBoss["send"]>[2] = {}) => {
        const id = await sender.send("email.send", { scenario, key: scenario }, options);
        if (!id) throw new Error(`no id for ${scenario}`);
        return id;
      };
      const ok = await send("ok", { deleteAfterSeconds: 1 });
      const flaky = await send("flaky", { retryLimit: 3, retryDelay: 1, retryBackoff: true });
      const dead = await send("dead", { retryLimit: 1, retryDelay: 1, retryBackoff: false });
      const slow = await send("slow", { expireInSeconds: 1, retryLimit: 0 });
      const kept = await sender.send("domain_event", { key: "retention" }, { retentionSeconds: 1 });
      if (!kept) throw new Error("no id for retention");

      // Every crm_app and crm_worker backend is a PgBouncer server connection, not a direct one.
      const clients = await admin<{ role: string; address: string | null }[]>`
        select distinct usename as role, host(client_addr) as address from pg_stat_activity
         where usename in ('crm_app', 'crm_worker')`;
      expect(clients.length).toBeGreaterThan(0);
      expect(clients.every((client) => client.address === pgbouncerAddress)).toBe(true);

      await waitFor("ok completed", stateIs(ok, "completed"));
      await waitFor("ok deleted after deleteAfterSeconds", gone(ok));
      expect(await waitFor("flaky completed", stateIs(flaky, "completed"))).toEqual({ state: "completed", retry_count: 2 });
      await waitFor("dead failed", stateIs(dead, "failed"));
      const [deadLetter] = await waitFor("dead-letter copy", async () => {
        const rows = await admin<{ id: string; state: string }[]>`
          select id, state from pgboss.job where name = 'email.send.dead' and data->>'key' = 'dead'`;
        return rows.length === 1 ? rows : undefined;
      });
      expect(deadLetter?.state).toBe("created");
      await waitFor("slow failed by expiry", stateIs(slow, "failed"), 30_000);
      await waitFor("retention job deleted", gone(kept), 30_000);

      // The admin command (jobs:retry, src/jobs/retry.ts): redrive the dead-letter copy back to email.send.
      handlerState.fixed = true;
      expect(await worker.redrive("email.send.dead", { ids: [deadLetter?.id ?? ""], sourceName: "email.send", limit: 1 })).toBe(1);
      await waitFor("redriven job completed", async () => {
        const rows = await admin<{ state: string }[]>`
          select state from pgboss.job where name = 'email.send' and source_root_id = ${dead}`;
        return rows.length === 1 && rows[0]?.state === "completed" ? true : undefined;
      });

      await waitFor("cron fired", async () => (cronRuns.length > 0 ? true : undefined), 75_000);
      await worker.unschedule("rate_limit.cleanup");
      expect(await admin`select name from pgboss.schedule`).toEqual([]);

      // Keep the worker up for the full window, then one more supervise, maintenance and monitor cycle.
      await sleep(Math.max(0, MIN_WORKER_RUN_MS - (Date.now() - workerStarted)));
      await sleep(2_500);
      workerRanMs = Date.now() - workerStarted;
    } finally {
      await worker.stop({ graceful: true, timeout: 10_000 });
      await sender.stop({ graceful: true });
    }
    expect(workerRanMs ?? 0).toBeGreaterThanOrEqual(MIN_WORKER_RUN_MS);
    await runSentinel();
    expect(permissionErrors((await serverLog(db.container)).slice(before), "crm_worker")).toEqual([SENTINEL_ERROR]);
    expect(permissionErrors((await serverLog(db.container)).slice(before), "crm_app")).toEqual([]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
