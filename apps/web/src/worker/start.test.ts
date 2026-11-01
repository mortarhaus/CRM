import { PgBoss } from "pg-boss";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DatabaseAlreadyOpenError, openDatabase } from "../db/system";
import { SEND_BOSS_OPTIONS } from "../jobs/options";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { startWorker } from "./start";

let database: TestDatabase;
let admin: postgres.Sql;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await admin?.end();
  await database?.stop();
});

// A failed test must not leave the process's crm_app pool open for the next one (openDatabase refuses a second).
afterEach(async () => {
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
});

const READY = JSON.stringify({ level: "info", msg: "worker ready" });
const STOPPED = JSON.stringify({ level: "info", msg: "worker stopped" });

async function connections(role: string): Promise<number> {
  const [row] = await admin<{ count: number }[]>`
    select count(*)::int as count from pg_stat_activity where usename = ${role} and pid <> pg_backend_pid()`;
  return row?.count ?? 0;
}

async function waitFor(check: () => Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

describe("startWorker", () => {
  it("works an email.send job sent by crm_app, then stop() closes pg-boss and the crm_app pool", async () => {
    const lines: string[] = [];
    const seen: unknown[] = [];
    const appDb = openDatabase(database.appUrl, { max: 3 });
    const worker = await startWorker({
      appDb,
      workerUrl: database.workerUrl,
      log: (line) => lines.push(line),
      handlers: { "email.send": async (jobs) => void seen.push(...jobs.map((job) => job.data)) },
    });
    expect(lines).toEqual([READY]);

    const sender = new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString: database.appUrl });
    await sender.start();
    const data = { workspaceId: crypto.randomUUID(), userId: crypto.randomUUID() };
    const id = await sender.send("email.send", data);
    await sender.stop();
    await waitFor(async () => {
      const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${id ?? ""}`;
      return row?.state === "completed";
    });
    expect(seen).toEqual([data]);

    await worker.stop();
    expect(lines).toEqual([READY, STOPPED]);
    await waitFor(async () => (await connections("crm_worker")) === 0 && (await connections("crm_app")) === 0, 5_000);
    // The pool is closed, so this process may open it again.
    await openDatabase(database.appUrl, { max: 1 }).close();
  });

  it("leaves a job of a queue without a handler waiting (no placeholder completes or fails it)", async () => {
    const appDb = openDatabase(database.appUrl, { max: 3 });
    const worker = await startWorker({ appDb, workerUrl: database.workerUrl, log: () => {} });
    const sender = new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString: database.appUrl });
    await sender.start();
    // email.send has no handler until plan Task 27 (domain_event since Task 19, the two cleanups since Task 24).
    const id = await sender.send("email.send", { workspaceId: crypto.randomUUID(), userId: crypto.randomUUID() });
    await sender.stop();
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${id ?? ""}`;
    expect(row?.state).toBe("created");
    await worker.stop();
    // The waiting job would be the next test's first email.send job.
    await admin`delete from pgboss.job_common where id = ${id ?? ""}`;
  });

  it("stops within Docker's 10 s while a handler never finishes and holds a crm_app query, and fails the job", async () => {
    const appDb = openDatabase(database.appUrl, { max: 3 });
    const cache = globalThis as typeof globalThis & { crmDb?: { sql: postgres.Sql } };
    const pool = cache.crmDb?.sql;
    if (!pool) throw new Error("no crm_app pool");
    const worker = await startWorker({
      appDb,
      workerUrl: database.workerUrl,
      log: () => {},
      handlers: {
        "email.send": async () => {
          await pool`select pg_sleep(60)`.catch(() => {});
          await new Promise(() => {});
        },
      },
    });
    const sender = new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString: database.appUrl });
    await sender.start();
    const id = await sender.send("email.send", { workspaceId: crypto.randomUUID(), userId: crypto.randomUUID() });
    await sender.stop();
    await waitFor(async () => {
      const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${id ?? ""}`;
      const [sleeping] = await admin<{ count: number }[]>`
        select count(*)::int as count from pg_stat_activity where usename = 'crm_app' and query like 'select pg_sleep%'`;
      return row?.state === "active" && sleeping?.count === 1;
    });

    const started = Date.now();
    await worker.stop();
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(10_000);
    const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${id ?? ""}`;
    expect(["failed", "retry"]).toContain(row?.state);
    // The pool's sockets are closed, but the server runs the abandoned pg_sleep until it ends (no statement_timeout
    // is set): only that backend may remain.
    const others = async () => {
      const [r] = await admin<{ count: number }[]>`
        select count(*)::int as count from pg_stat_activity
         where usename = 'crm_app' and query not like 'select pg_sleep%' and pid <> pg_backend_pid()`;
      return r?.count ?? 0;
    };
    await waitFor(async () => (await connections("crm_worker")) === 0 && (await others()) === 0, 5_000);
    await admin`select pg_terminate_backend(pid) from pg_stat_activity where usename = 'crm_app'`;
  });

  it("refuses a second crm_app pool in one process", async () => {
    const appDb = openDatabase(database.appUrl, { max: 1 });
    expect(() => openDatabase(database.appUrl, { max: 1 })).toThrow(DatabaseAlreadyOpenError);
    await appDb.close();
  });

  it("fails fast instead of reporting ready when the database is unreachable, and closes the pool", async () => {
    const lines: string[] = [];
    const appDb = openDatabase("postgres://nobody:nothing@127.0.0.1:1/none?connect_timeout=2", { max: 1 });
    await expect(startWorker({ appDb, workerUrl: database.workerUrl, log: (line) => lines.push(line) })).rejects.toThrow();
    expect(lines).toEqual([]);
    await openDatabase(database.appUrl, { max: 1 }).close();
  });
});
