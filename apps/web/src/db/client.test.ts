import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { createDb, type DbHandle } from "./client";

let database: TestDatabase;
let handle: DbHandle;

beforeAll(async () => {
  database = await startDatabase();
  handle = createDb(database.appUrl);
});

afterAll(async () => {
  await handle?.sql.end();
  await database?.stop();
});

describe("createDb", () => {
  it("runs queries over the postgres TCP driver as crm_app", async () => {
    const rows = await handle.sql<{ ok: number; user: string }[]>`select 1 as ok, current_user as user`;
    expect(rows[0]).toEqual({ ok: 1, user: "crm_app" });
  });

  it("exposes a Drizzle instance on the same pool", async () => {
    // drizzle-orm 0.45.3's postgres-js driver leaves timestamptz unparsed in raw execute(), so now() is a string.
    const rows = await handle.db.execute<{ now: string }>(sql`select now() as now`);
    expect(typeof rows[0]?.now).toBe("string");
    expect(rows[0]?.now).toMatch(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
  });
});

// postgres.js 3.4.9 is patched (patches/postgres@3.4.9.patch; docs/DECISIONS.md, PR #44 P2-2): when the backend of
// an open transaction ends (a Postgres restart, a failover, pg_terminate_backend), the transaction's later
// statements are refused, no uncaught error is thrown, and the pool's connection works again. Unpatched, the
// ROLLBACK is written to the closed socket on a later tick (an uncaught TypeError), the connection keeps those bytes
// and hangs on its next use, and a statement issued after the pool reconnected runs outside the transaction.
describe("a backend ended inside a transaction", () => {
  let admin: ReturnType<typeof postgres>;
  const uncaught: unknown[] = [];
  const record = (error: unknown) => uncaught.push(error);

  beforeAll(() => {
    admin = postgres(database.adminUrl, { max: 1 });
    process.on("uncaughtException", record);
  });

  afterAll(async () => {
    process.off("uncaughtException", record);
    await admin?.end();
  });

  // Ends the backend of `pool`'s one connection once it runs the statement `marker` names.
  async function endBackendRunning(marker: string): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const rows = await admin<{ pid: number }[]>`
        select pid from pg_stat_activity where usename = 'crm_app' and state = 'active' and query like ${`%${marker}%`}
          and pid <> pg_backend_pid()`;
      if (rows[0]) {
        await admin`select pg_terminate_backend(${rows[0].pid})`;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`no backend ran ${marker}`);
  }

  // Resolves with what `promise` gave, or "timed out" after `ms`.
  function within<T>(promise: Promise<T>, ms: number): Promise<T | "timed out"> {
    return Promise.race([promise, new Promise<"timed out">((resolve) => setTimeout(() => resolve("timed out"), ms))]);
  }

  it("rejects the transaction, throws nothing uncaught, and the connection serves the next query", async () => {
    const pool = createDb(database.appUrl, { max: 1 });
    try {
      const transaction = pool.db
        .transaction(async (tx) => {
          await tx.execute(sql`select pg_sleep(30) as p22_rollback_path`);
        })
        .then(
          () => "committed",
          () => "rejected",
        );
      await endBackendRunning("p22_rollback_path");
      expect(await within(transaction, 5_000)).toBe("rejected");
      // The unpatched driver writes the ROLLBACK on a later tick (setImmediate).
      await new Promise((resolve) => setTimeout(resolve, 200));
      const next = within(
        pool.sql<{ ok: number }[]>`select 1 as ok`.then((rows) => rows[0]?.ok),
        5_000,
      );
      expect(await next).toBe(1);
      expect(uncaught).toEqual([]);
    } finally {
      await pool.sql.end({ timeout: 1 });
    }
  });

  it("refuses a statement of the ended transaction after the pool reconnected, instead of running it outside", async () => {
    const pool = createDb(database.appUrl, { max: 1 });
    try {
      const [{ pid: before } = { pid: 0 }] = await pool.sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
      let reconnected: () => void = () => undefined;
      const poolReconnected = new Promise<void>((resolve) => (reconnected = resolve));
      // What happened to the transaction's statement issued after the pool reconnected (the transaction promise
      // itself rejects as soon as the connection closes, so it cannot tell).
      let settle: (outcome: unknown) => void = () => undefined;
      const statementOutcome = new Promise<unknown>((resolve) => (settle = resolve));
      void pool.db
        .transaction(async (tx) => {
          await tx.execute(sql`select pg_sleep(30) as p22_late_statement`).catch(() => undefined);
          await poolReconnected;
          await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`).then(
            (rows) => settle({ ranOn: rows[0]?.pid }),
            () => settle("refused"),
          );
        })
        .catch(() => undefined);
      await endBackendRunning("p22_late_statement");
      // The pool's one connection comes back for a new query (a new backend).
      const [{ pid: after } = { pid: before }] = await pool.sql<{ pid: number }[]>`select pg_backend_pid() as pid`;
      expect(after).not.toBe(before);
      reconnected();
      expect(await within(statementOutcome, 5_000)).toBe("refused");
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(uncaught).toEqual([]);
    } finally {
      await pool.sql.end({ timeout: 1 });
    }
  });

  it("rejects a statement queued behind a busy one when the backend ends, instead of leaving it pending", async () => {
    const pool = createDb(database.appUrl, { max: 1 });
    try {
      let settle: (outcome: unknown) => void = () => undefined;
      const queuedOutcome = new Promise<unknown>((resolve) => (settle = resolve));
      void pool.db
        .transaction(async (tx) => {
          // A statement with a parameter is described first, so the connection takes no second one until it
          // answers: the second statement waits in the transaction's own queue.
          const busy = tx.execute(sql`select pg_sleep(30) as p22_queued, ${1}::int as one`).catch(() => undefined);
          const queued = tx.execute(sql`select ${2}::int as two`).then(
            () => settle("ran"),
            () => settle("rejected"),
          );
          await Promise.all([busy, queued]);
        })
        .catch(() => undefined);
      await endBackendRunning("p22_queued");
      expect(await within(queuedOutcome, 5_000)).toBe("rejected");
      expect(await within(pool.sql<{ ok: number }[]>`select 1 as ok`.then((rows) => rows[0]?.ok), 5_000)).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(uncaught).toEqual([]);
    } finally {
      await pool.sql.end({ timeout: 1 });
    }
  });
});
