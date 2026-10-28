import type { ConstructorOptions } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, PoolBypassError } from "../db/client";
import { createAuthTransactions } from "../db/system";
import { startDatabase, type TestDatabase } from "../test/postgres";

// Every PgBoss this module builds is recorded with its options and start() calls (the real class does the work).
const constructed: { options: ConstructorOptions; starts: number }[] = [];
vi.mock("pg-boss", async (importOriginal) => {
  const real = await importOriginal<typeof import("pg-boss")>();
  class RecordedPgBoss extends real.PgBoss {
    readonly record: { options: ConstructorOptions; starts: number };
    constructor(options: ConstructorOptions) {
      super(options);
      this.record = { options, starts: 0 };
      constructed.push(this.record);
    }
    override start() {
      this.record.starts += 1;
      return super.start();
    }
  }
  return { ...real, PgBoss: RecordedPgBoss };
});

let databaseUrl = "";
vi.mock("../lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));

const { createSendBoss, createWorkerBoss, getSendBoss } = await import("./boss");

let database: TestDatabase;
let admin: postgres.Sql;
const cache = globalThis as typeof globalThis & { crmSendBoss?: Promise<unknown> };

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await (await cache.crmSendBoss?.catch(() => undefined) as { stop(): Promise<void> } | undefined)?.stop();
  await admin?.end();
  await database?.stop();
});

beforeEach(() => {
  constructed.length = 0;
});

describe("getSendBoss (the web send-only instance)", () => {
  it("is crm_app on DATABASE_URL with the four locked switches off and a pool of 2, started once per process", async () => {
    databaseUrl = database.appUrl;
    const [first, second] = await Promise.all([getSendBoss(), getSendBoss()]);
    expect(second).toBe(first);
    expect(await getSendBoss()).toBe(first);
    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.starts).toBe(1);
    expect(constructed[0]?.options).toMatchObject({
      connectionString: database.appUrl,
      max: 2,
      migrate: false,
      createSchema: false,
      supervise: false,
      schedule: false,
    });
    expect(await first.send("email.send", { workspaceId: crypto.randomUUID() })).toMatch(/^[0-9a-f-]{36}$/);
    await first.stop();
    cache.crmSendBoss = undefined;
  });

  it("does not cache a failed start: the next call starts a new instance", async () => {
    databaseUrl = "postgres://nobody:nothing@127.0.0.1:1/none?connect_timeout=2";
    await expect(getSendBoss()).rejects.toThrow();
    expect(cache.crmSendBoss).toBeUndefined();
    databaseUrl = database.appUrl;
    const boss = await getSendBoss();
    expect(constructed).toHaveLength(2);
    await boss.stop();
    cache.crmSendBoss = undefined;
  });
});

describe("createWorkerBoss (the worker instance)", () => {
  it("has the Task 17 options: supervise and schedule on, no migrate, schema, reindex or persistence, a pool of 3", () => {
    createWorkerBoss(database.workerUrl);
    expect(constructed[0]?.options).toEqual({
      connectionString: database.workerUrl,
      max: 3,
      migrate: false,
      createSchema: false,
      supervise: true,
      schedule: true,
      reindex: false,
      persistQueueStats: false,
      persistWarnings: false,
    });
  });

  it("logs a pg-boss error as its name and SQLSTATE only, never its message (UNI-09)", () => {
    const lines: string[] = [];
    const boss = createWorkerBoss(database.workerUrl, (line) => lines.push(line));
    const error = Object.assign(new Error('invalid input syntax for type uuid: "a@example.com"'), { code: "22P02" });
    boss.emit("error", error);
    // pg-boss's manager emits a spread copy with the queue added (manager.js, `{ ...error, message, stack, queue }`).
    boss.emit("error", { ...error, name: "error", message: error.message, queue: "email.send" } as Error);
    expect(lines).toEqual([
      JSON.stringify({ level: "error", msg: "pg-boss error", error: "Error", code: "22P02" }),
      JSON.stringify({ level: "error", msg: "pg-boss error", error: "error", code: "22P02", queue: "email.send" }),
    ]);
  });
});

// pg-boss has its own `pg` pool. The auth-transaction guard (PoolBypassError) and slot bound (PR #44 P2-1) wrap the
// postgres.js crm_app pool only, so pg-boss neither trips the guard nor takes a slot. The other side, for Task 19:
// a send() inside a request transaction without `db: fromDrizzle(tx, sql)` is not part of that transaction.
describe("the send-only instance and the auth transactions", () => {
  it("sends inside a held auth transaction without PoolBypassError, outside the transaction, and takes no slot", async () => {
    const handle = createDb(database.appUrl, { max: 2 });
    const auth = createAuthTransactions(handle.db);
    expect(auth.slots).toBe(1);
    const boss = await createSendBoss(database.appUrl).start();
    try {
      const inside = await auth.run(null, () => boss.send("email.send", { workspaceId: crypto.randomUUID() }), () => false);
      expect(inside.committed).toBe(false);
      const [row] = await admin<{ state: string }[]>`select state from pgboss.job_common where id = ${inside.result ?? ""}`;
      // Rolled back, yet the job is there: it went through pg-boss's own pool.
      expect(row?.state).toBe("created");

      // The one slot held by a waiting transaction: pg-boss still sends at once.
      let release = () => {};
      const held = auth.run(null, () => new Promise<void>((resolve) => (release = resolve)), () => true);
      const started = Date.now();
      expect(await boss.send("email.send", { workspaceId: crypto.randomUUID() })).toBeTruthy();
      expect(Date.now() - started).toBeLessThan(2_000);
      release();
      await held;

      // And the guard still fires for the crm_app pool itself.
      await expect(auth.run(null, () => handle.db.execute("select 1"), () => true)).rejects.toBeInstanceOf(PoolBypassError);
    } finally {
      await boss.stop();
      await handle.sql.end();
    }
  });
});
