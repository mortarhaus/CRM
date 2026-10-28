import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { type Job, PgBoss } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { permissionErrors, serverLog, startDatabase, type TestDatabase } from "../test/postgres";
import { SEND_BOSS_OPTIONS, WORKER_BOSS_OPTIONS } from "./options";

// crm_worker's exact grants (plan Task 17, Settled item 2): the worker instance, with the production switches and
// the shortest intervals pg-boss 12.35.0 allows, runs the whole worker operation set as crm_worker with zero
// permission errors in the server log and zero `error` events; then each grant is removed in turn (ablation) and
// the operation that needs it fails with 42501. Real time, no TestClock (it runs DDL).

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

type Scenario = "ok" | "flaky" | "dead" | "slow";
interface Data {
  scenario: Scenario;
  key: string;
}

let db: TestDatabase;
let admin: postgres.Sql;

beforeAll(async () => {
  db = await startDatabase({ serverLog: true });
  admin = postgres(db.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await admin?.end();
  await db?.stop();
});

interface Instance {
  boss: PgBoss;
  errors: unknown[];
  warnings: unknown[];
}

function instance(options: ConstructorParameters<typeof PgBoss>[0] & object): Instance {
  const boss = new PgBoss(options);
  const errors: unknown[] = [];
  const warnings: unknown[] = [];
  boss.on("error", (error) => errors.push(error));
  boss.on("warning", (warning) => warnings.push(warning));
  return { boss, errors, warnings };
}

const workerInstance = () => instance({ ...WORKER_BOSS_OPTIONS, ...SHORT_INTERVALS, connectionString: db.workerUrl });
const senderInstance = () => instance({ ...SEND_BOSS_OPTIONS, connectionString: db.appUrl });
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

// The handler for email.send: each scenario's job behaves as its name says. `fixed` turns the dead-letter
// scenario into a success, for the retry admin command.
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

// 12.35.0 types CommandResponse as an empty interface; at runtime it is { jobs, requested, affected }.
const affected = (response: unknown) => (response as { affected?: number }).affected;

async function privilege(sql: string): Promise<boolean> {
  const [row] = await admin.unsafe<{ held: boolean }[]>(`select ${sql} as held`);
  return row?.held ?? false;
}

// A statement crm_worker is denied, run just before the log is read: the permission errors of the slice must be
// this one and nothing else, so an empty result cannot come from reading the wrong part of the log.
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

describe("the pg-boss patch (patches/pg-boss@12.35.0.patch; docs/DECISIONS.md 2026-10-27)", () => {
  it("is applied to the installed pg-boss: start() creates the cron queue only when it is missing", async () => {
    // Fails when an upgrade or a reinstall drops the patch; the start test below then fails with 42501 as well.
    const require = createRequire(import.meta.url);
    const source = await readFile(join(dirname(require.resolve("pg-boss/package.json")), "dist", "timekeeper.js"), "utf8");
    expect(source).toContain("crm-patch(send-it-exists)");
    expect(source).toContain("if (!(await this.manager.getQueue(QUEUES.SEND_IT))) {");
    expect(source).not.toMatch(/^ {8}await this\.manager\.createQueue\(QUEUES\.SEND_IT\);$/m);
  });

  it("crm_worker cannot create a queue: no EXECUTE on create_queue, no INSERT on pgboss.queue", async () => {
    expect(await privilege(`has_function_privilege('crm_worker', 'pgboss.create_queue(text, jsonb)', 'EXECUTE')`)).toBe(false);
    expect(await privilege(`has_table_privilege('crm_worker', 'pgboss.queue', 'INSERT')`)).toBe(false);
    expect(await privilege(`has_any_column_privilege('crm_worker', 'pgboss.queue', 'INSERT')`)).toBe(false);
  });

  it("crm_worker cannot change queue options or the schema version (UPDATE is column-limited)", async () => {
    for (const column of ["policy", "retry_limit", "retry_delay", "dead_letter", "notify", "partition", "table_name"]) {
      expect(await privilege(`has_column_privilege('crm_worker', 'pgboss.queue', '${column}', 'UPDATE')`)).toBe(false);
    }
    expect(await privilege(`has_column_privilege('crm_worker', 'pgboss.version', 'version', 'UPDATE')`)).toBe(false);
  });

  it("the worker starts as crm_worker with schedule on, with zero permission errors and zero error events", async () => {
    const before = (await serverLog(db.container)).length;
    const worker = workerInstance();
    await worker.boss.start();
    // A cron pass and a supervise pass at the 1 s intervals.
    await sleep(2_500);
    await worker.boss.stop({ graceful: true, timeout: 10_000 });
    await runSentinel();
    expect(permissionErrors((await serverLog(db.container)).slice(before), "crm_worker")).toEqual([SENTINEL_ERROR]);
    expect(worker.errors).toEqual([]);
  });
});

describe("crm_worker: the worker operation set (plan Task 17 Step 1)", () => {
  it(
    "runs with zero permission errors and zero error events",
    async () => {
      const before = (await serverLog(db.container)).length;
      const sender = senderInstance();
      const worker = workerInstance();
      await sender.boss.start();
      await worker.boss.start();
      const handlerState = { attempts: new Map<string, number>(), fixed: false };
      const cronRuns: string[] = [];
      try {
        await worker.boss.work<Data>("email.send", POLL, emailHandler(handlerState));
        await worker.boss.work("rate_limit.cleanup", POLL, async ([job]) => {
          if (job) cronRuns.push(job.id);
        });
        // schedule() first: the cron fires at the next minute, so the other scenarios run while it waits.
        await worker.boss.schedule("rate_limit.cleanup", "* * * * *");

        const send = async (scenario: Scenario, options: Parameters<PgBoss["send"]>[2] = {}) => {
          const id = await sender.boss.send("email.send", { scenario, key: scenario }, options);
          if (!id) throw new Error(`no id for ${scenario}`);
          return id;
        };
        // work() + complete(); then deletion of the completed job after deleteAfterSeconds.
        const ok = await send("ok", { deleteAfterSeconds: 1 });
        // A handler that throws twice, then succeeds (retry with backoff).
        const flaky = await send("flaky", { retryLimit: 3, retryDelay: 1, retryBackoff: true });
        // Retries exhausted: the job fails and a copy lands in email.send.dead.
        const dead = await send("dead", { retryLimit: 1, retryDelay: 1, retryBackoff: false });
        // expireInSeconds exceeded while the handler runs: maintenance fails it.
        const slow = await send("slow", { expireInSeconds: 1, retryLimit: 0 });
        // retentionSeconds passed on a job nobody fetches (no worker on domain_event): maintenance deletes it.
        const kept = await sender.boss.send("domain_event", { key: "retention" }, { retentionSeconds: 1 });
        if (!kept) throw new Error("no id for retention");

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

        // The admin command (Task 18): retry the failed job in its own queue. The dead-letter copy is a new job in
        // state created, so retry() on it changes nothing.
        expect(affected(await worker.boss.retry("email.send.dead", deadLetter?.id ?? ""))).toBe(0);
        handlerState.fixed = true;
        expect(affected(await worker.boss.retry("email.send", dead))).toBe(1);
        await waitFor("retried job completed", stateIs(dead, "completed"));

        await waitFor("cron fired", async () => (cronRuns.length > 0 ? true : undefined), 75_000);
        await worker.boss.unschedule("rate_limit.cleanup");
        expect(await admin`select name from pgboss.schedule`).toEqual([]);
        // One more full maintenance and monitor cycle after the last operation.
        await sleep(2_500);
      } finally {
        await worker.boss.stop({ graceful: true, timeout: 10_000 });
        await sender.boss.stop({ graceful: true });
      }
      await runSentinel();
      expect(permissionErrors((await serverLog(db.container)).slice(before), "crm_worker")).toEqual([SENTINEL_ERROR]);
      expect(worker.errors).toEqual([]);
      expect(sender.errors).toEqual([]);
      expect(worker.warnings).toEqual([]);
    },
    150_000,
  );
});

// Runs the worker operation set (start, work, complete, fail to the dead letter, retry, expiry, deletion, schedule,
// unschedule, the cron and maintenance loops) until crm_worker hits a permission error that starts with `expected`,
// or the time runs out. Returns the permission errors seen.
async function runUntilDenied(expected: string, timeoutMs = 15_000): Promise<string[]> {
  const before = (await serverLog(db.container)).length;
  const denied = async () =>
    permissionErrors((await serverLog(db.container)).slice(before), "crm_worker").filter((line) =>
      line.startsWith(`${expected} `),
    );
  const sender = senderInstance();
  const worker = workerInstance();
  const attempt = async (step: () => Promise<unknown>) => {
    try {
      await step();
    } catch {
      // the log is the evidence
    }
  };
  await sender.boss.start();
  try {
    await attempt(() => worker.boss.start());
    await attempt(() =>
      worker.boss.work<Data>("email.send", POLL, async ([job]) => {
        if (job?.data.scenario === "dead") throw new Error("dead");
        if (job?.data.scenario === "slow") await sleep(3_000);
      }),
    );
    await attempt(() => worker.boss.schedule("rate_limit.cleanup", "* * * * *"));
    await attempt(() => worker.boss.unschedule("rate_limit.cleanup"));
    await sender.boss.send("email.send", { scenario: "ok", key: "ok" }, { deleteAfterSeconds: 0 });
    const dead = await sender.boss.send("email.send", { scenario: "dead", key: "dead" }, { retryLimit: 0 });
    await sender.boss.send("email.send", { scenario: "slow", key: "slow" }, { expireInSeconds: 1, retryLimit: 0 });
    await sender.boss.send("domain_event", { key: "retention" }, { retentionSeconds: 1 });
    const deadline = Date.now() + timeoutMs;
    let retried = false;
    while (Date.now() < deadline && (await denied()).length === 0) {
      if (!retried && dead && (await jobState(dead))?.state === "failed") {
        retried = true;
        await attempt(() => worker.boss.retry("email.send", dead));
      }
      await sleep(500);
    }
  } finally {
    await worker.boss.stop({ graceful: false, timeout: 5_000 }).catch(() => {});
    await sender.boss.stop({ graceful: false }).catch(() => {});
  }
  return denied();
}

// Ablation (Settled item 2, step 5): each grant of migration 0018, column grants included, is needed. Revoked
// through the admin connection one at a time and restored after the case.
const QUEUE_UPDATE_COLUMNS = [
  "monitor_claim_on",
  "monitor_on",
  "maintain_on",
  "deferred_count",
  "queued_count",
  "ready_count",
  "active_count",
  "failed_count",
  "total_count",
  "singletons_active",
  "ready_history",
];
const ABLATION: [grant: string, denial: string][] = [
  ["USAGE ON SCHEMA pgboss", "permission denied for schema pgboss"],
  ["EXECUTE ON FUNCTION pgboss.job_now()", "permission denied for function job_now"],
  ["SELECT ON pgboss.version", "permission denied for table version"],
  ...["cron_on", "flow_on", "monitor_backoff_on"].map(
    (column): [string, string] => [`UPDATE (${column}) ON pgboss.version`, "permission denied for table version"],
  ),
  ["SELECT ON pgboss.queue", "permission denied for table queue"],
  ...QUEUE_UPDATE_COLUMNS.map(
    (column): [string, string] => [`UPDATE (${column}) ON pgboss.queue`, "permission denied for table queue"],
  ),
  ...["SELECT", "INSERT", "UPDATE", "DELETE"].map(
    (privilege): [string, string] => [`${privilege} ON pgboss.schedule`, "permission denied for table schedule"],
  ),
  ...["SELECT", "INSERT", "UPDATE", "DELETE"].map(
    (privilege): [string, string] => [`${privilege} ON pgboss.job_common`, "permission denied for table job_common"],
  ),
  ...["SELECT", "INSERT", "UPDATE"].map(
    (privilege): [string, string] => [`${privilege} ON pgboss.job`, "permission denied for table job"],
  ),
  ...["SELECT", "DELETE"].map(
    (privilege): [string, string] => [`${privilege} ON pgboss.job_dependency`, "permission denied for table job_dependency"],
  ),
];

describe.each(ABLATION)("crm_worker ablation: without %s", (grant, denial) => {
  it(`an operation fails with "${denial}"`, async () => {
    await admin.unsafe(`REVOKE ${grant} FROM crm_worker`);
    try {
      expect((await runUntilDenied(denial)).length).toBeGreaterThan(0);
    } finally {
      await admin.unsafe(`GRANT ${grant} TO crm_worker`);
    }
  }, 40_000);
});
