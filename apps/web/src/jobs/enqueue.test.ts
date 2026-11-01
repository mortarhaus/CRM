import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type EventPayload, minorUnits, parseMinorUnits } from "@crm/core/events";
import { sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { openDatabase } from "../db/system";
import { type Tx, withWorkspace } from "../db/workspace";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { startWorker, type WorkerHandle } from "../worker/start";
import { getSendBoss } from "./boss";
import { type DomainEvent, domainEventHandler } from "./domain-event";
import { emitEvent, enqueueJob, EventPayloadError, type JobData, JobDataError } from "./enqueue";

// Plan Task 19 Step 2: domain_event rows and their pg-boss jobs are written in the caller's transaction (EVT-01), as
// crm_app, and a worker on crm_worker works them through the domain_event handler.

let databaseUrl = "";
vi.mock("../lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));

let database: TestDatabase;
let admin: postgres.Sql;
let worker: WorkerHandle;
let workspaceA = "";
let workspaceB = "";
// Every event the worker's domain_event handler loaded, as the core handler of invoice.issued saw it.
const loaded: DomainEvent[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(what: string, check: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(200);
  }
}

async function createWorkspace(name: string): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values (${name}, ${`${name}-${crypto.randomUUID()}`}, now())
    returning id`;
  if (!row) throw new Error("workspace not created");
  return row.id;
}

async function eventRows(id: string): Promise<number> {
  const [row] = await admin<{ count: number }[]>`select count(*)::int as count from domain_event where id = ${id}`;
  return row?.count ?? 0;
}

async function jobs(where: { id?: string; key?: string; value?: string }): Promise<{ id: string; state: string; data: unknown }[]> {
  if (where.id) return admin`select id, state, data from pgboss.job_common where id = ${where.id}`;
  return admin`select id, state, data from pgboss.job_common where data->>${where.key ?? ""} = ${where.value ?? ""}`;
}

const invoiceIssued = (payload: EventPayload) => ({ name: "invoice.issued" as const, version: 1, payload });
const rollback = new Error("rollback");

beforeAll(async () => {
  database = await startDatabase();
  databaseUrl = database.appUrl;
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  workspaceA = await createWorkspace("events-a");
  workspaceB = await createWorkspace("events-b");
  // The process's crm_app pool (what getDb() and so withWorkspace() use), shared by the producer and the worker.
  const appDb = openDatabase(database.appUrl, { max: 4 });
  worker = await startWorker({
    appDb,
    workerUrl: database.workerUrl,
    log: () => {},
    handlers: {
      domain_event: domainEventHandler({ "invoice.issued": [async (event) => void loaded.push(event)] }),
    },
  });
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmSendBoss?: Promise<{ stop(): Promise<void> }> };
  await (await cache.crmSendBoss?.catch(() => undefined))?.stop();
  cache.crmSendBoss = undefined;
  await worker?.stop();
  await admin?.end();
  await database?.stop();
});

describe("emitEvent: the event and its job are atomic with the transaction (EVT-01)", () => {
  it("leaves no event and no job when the transaction rolls back, 50 times", async () => {
    for (let run = 0; run < 50; run += 1) {
      let eventId = "";
      await expect(
        withWorkspace(workspaceA, async (tx) => {
          eventId = await emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID() }));
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect(eventId).not.toBe("");
      expect(await eventRows(eventId)).toBe(0);
      expect(await jobs({ id: eventId })).toEqual([]);
    }
  });

  it("commits one row and one job whose id is the event id, and the worker loads the row under its workspace", async () => {
    const invoiceId = crypto.randomUUID();
    const eventId = await withWorkspace(workspaceA, (tx) => emitEvent(tx, invoiceIssued({ invoiceId })));
    const [row] = await admin<{ workspace_id: string; name: string; version: number; payload: unknown }[]>`
      select workspace_id, name, version, payload from domain_event where id = ${eventId}`;
    expect(row).toEqual({ workspace_id: workspaceA, name: "invoice.issued", version: 1, payload: { invoiceId } });
    const [job] = await jobs({ id: eventId });
    expect(job?.data).toEqual({ workspaceId: workspaceA, eventId });
    const event = await waitFor("event loaded", async () => loaded.find((seen) => seen.id === eventId));
    expect(event).toEqual({ id: eventId, workspaceId: workspaceA, name: "invoice.issued", version: 1, payload: { invoiceId } });
    await waitFor("job completed", async () => ((await jobs({ id: eventId }))[0]?.state === "completed" ? true : undefined));
  });

  it("is invisible to other connections and to the worker until commit", async () => {
    let eventId = "";
    await withWorkspace(workspaceA, async (tx) => {
      eventId = await emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID() }));
      expect(await jobs({ id: eventId })).toEqual([]);
      expect(await eventRows(eventId)).toBe(0);
      // Longer than the worker's 2 s polling interval.
      await sleep(3_000);
      expect(loaded.some((seen) => seen.id === eventId)).toBe(false);
      expect(await jobs({ id: eventId })).toEqual([]);
    });
    await waitFor("event loaded after commit", async () => loaded.find((seen) => seen.id === eventId));
  });

  it("creates one job for the same id sent twice", async () => {
    const eventId = await withWorkspace(workspaceA, async (tx) => {
      const id = await emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID() }));
      const boss = await getSendBoss();
      const again = await boss.send("domain_event", { workspaceId: workspaceA, eventId: id }, { db: fromDrizzle(tx, sql), id });
      expect(again).toBeNull();
      return id;
    });
    expect(await jobs({ id: eventId })).toHaveLength(1);
    const [count] = await admin<{ count: number }[]>`
      select count(*)::int as count from pgboss.job_common where data->>'eventId' = ${eventId}`;
    expect(count?.count).toBe(1);
  });
});

describe("emitEvent: the payload carries IDs and amounts only", () => {
  const refused = async (payload: unknown, message: string) => {
    let statements = 0;
    let eventId: string | undefined;
    await expect(
      withWorkspace(workspaceA, async (tx) => {
        const execute = vi.spyOn(tx, "execute");
        const insert = vi.spyOn(tx, "insert");
        try {
          eventId = await emitEvent(tx, invoiceIssued(payload as EventPayload));
        } finally {
          statements = execute.mock.calls.length + insert.mock.calls.length;
        }
      }),
    ).rejects.toThrow(new EventPayloadError(message));
    expect(eventId).toBeUndefined();
    expect(statements).toBe(0);
  };

  it.each([
    ["an email", { contactId: "a@x" }, "payload.contactId is not an ID or amount"],
    ["a zero-padded amount", { amount: "007" }, "payload.amount is not an ID or amount"],
    ["a decimal amount", { amount: "1.5" }, "payload.amount is not an ID or amount"],
    ["a negative amount", { amount: "-1" }, "payload.amount is not an ID or amount"],
    ["an unsafe number", { count: 2 ** 53 }, "payload.count is not an ID or amount"],
    ["a fractional number", { count: 1.5 }, "payload.count is not an ID or amount"],
    ["a nested object", { invoice: { id: crypto.randomUUID() } }, "payload.invoice is not an ID or amount"],
  ])("refuses %s before any statement, naming the field only (UNI-09)", async (_, payload, message) => {
    await refused(payload, message);
  });

  it("refuses a raw bigint before the transaction writes, and points to minorUnits()", async () => {
    const counts = () => admin<{ events: number; jobs: number }[]>`
      select (select count(*)::int from domain_event) as events, (select count(*)::int from pgboss.job_common) as jobs`;
    const before = await counts();
    await refused({ amount: 1n }, "payload.amount is a bigint; encode money with minorUnits()");
    expect(await counts()).toEqual(before);
  });

  it("is a type error to pass a bigint without a cast", () => {
    const typed = (tx: Tx) =>
      // @ts-expect-error a bigint is not an EventPayloadValue: money crosses the boundary as minorUnits()
      emitEvent(tx, { name: "invoice.issued", version: 1, payload: { amount: 1n } });
    expect(typed).toBeTypeOf("function");
  });

  it("round-trips an amount beyond Number.MAX_SAFE_INTEGER exactly, as a JSON string", async () => {
    const invoiceId = crypto.randomUUID();
    const eventId = await withWorkspace(workspaceA, (tx) =>
      emitEvent(tx, invoiceIssued({ invoiceId, amount: minorUnits(9007199254740993n) })),
    );
    const [row] = await admin<{ type: string; amount: string }[]>`
      select jsonb_typeof(payload->'amount') as type, payload->>'amount' as amount from domain_event where id = ${eventId}`;
    expect(row).toEqual({ type: "string", amount: "9007199254740993" });
    const event = await waitFor("event loaded", async () => loaded.find((seen) => seen.id === eventId));
    expect(event.workspaceId).toBe(workspaceA);
    const amount = event.payload.amount;
    if (typeof amount !== "string") throw new Error("amount is not a string");
    expect(parseMinorUnits(amount)).toBe(9007199254740993n);
  });

  it("keeps the event and its job together with the large amount: none on rollback, one of each on commit", async () => {
    let eventId = "";
    await expect(
      withWorkspace(workspaceA, async (tx) => {
        eventId = await emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID(), amount: minorUnits(9007199254740993n) }));
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await eventRows(eventId)).toBe(0);
    expect(await jobs({ id: eventId })).toEqual([]);

    const committed = await withWorkspace(workspaceA, (tx) =>
      emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID(), amount: minorUnits(9007199254740993n) })),
    );
    expect(await eventRows(committed)).toBe(1);
    const found = await jobs({ id: committed });
    expect(found.map((job) => job.id)).toEqual([committed]);
  });
});

describe("job data carries IDs only (PROJECT.md §9)", () => {
  it.each([
    ["a non-ID key", (userId: string) => ({ workspaceId: workspaceA, userId, kind: "test" }), "job.kind is not an ID"],
    ["a non-uuid value", () => ({ workspaceId: workspaceA, userId: "a@x" }), "job.userId is not an ID"],
    ["no workspaceId", (userId: string) => ({ userId }), "job.workspaceId is not an ID"],
  ])("refuses %s before any statement, naming the key only, and leaves no job", async (_, build, message) => {
    const userId = crypto.randomUUID();
    let statements = 0;
    await expect(
      withWorkspace(workspaceA, async (tx) => {
        const execute = vi.spyOn(tx, "execute");
        try {
          await enqueueJob(tx, "email.send", build(userId) as unknown as JobData);
        } finally {
          statements = execute.mock.calls.length;
        }
      }),
    ).rejects.toThrow(new JobDataError(message));
    expect(statements).toBe(0);
    expect(await jobs({ key: "userId", value: userId })).toEqual([]);
  });

  it("accepts { workspaceId, userId } and commits the job with the transaction", async () => {
    const userId = crypto.randomUUID();
    const id = await withWorkspace(workspaceA, (tx) => enqueueJob(tx, "email.send", { workspaceId: workspaceA, userId }));
    const [job] = await jobs({ id: id ?? "" });
    expect(job?.data).toEqual({ workspaceId: workspaceA, userId });

    const rolledBack = crypto.randomUUID();
    await expect(
      withWorkspace(workspaceA, async (tx) => {
        await enqueueJob(tx, "email.send", { workspaceId: workspaceA, userId: rolledBack });
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    expect(await jobs({ key: "userId", value: rolledBack })).toEqual([]);
  });

  // Every enqueueJob/emitEvent call site of Phase 1, with the job data its queue gets. domain_event has no app call
  // site in Phase 1 and is run directly; email.send through settings/email/actions.ts arrives with plan Task 27.
  const PRODUCERS: { queue: string; callSite: string | null; run: (tx: Tx) => Promise<string | null> }[] = [
    { queue: "domain_event", callSite: null, run: (tx) => emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID() })) },
  ];

  it.each(PRODUCERS)("$queue: the stored job data has only keys ending in Id, each a uuid", async ({ queue, run }) => {
    const id = await withWorkspace(workspaceA, run);
    const [job] = await admin<{ name: string; data: Record<string, unknown> }[]>`
      select name, data from pgboss.job_common where id = ${id ?? ""}`;
    expect(job?.name).toBe(queue);
    const entries = Object.entries(job?.data ?? {});
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(key).toMatch(/^[a-z][A-Za-z]*Id$/);
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    }
  });

  it("lists every producer: no other enqueueJob/emitEvent call site, and getSendBoss() only in enqueue.ts", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const files = (await readdir(root, { recursive: true }))
      .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.ts$/.test(file))
      .map((file) => join(root, file));
    expect(files.length).toBeGreaterThan(20);
    const callSites: string[] = [];
    const sendBoss: string[] = [];
    for (const file of files) {
      const path = relative(root, file);
      const lines = (await readFile(file, "utf8")).split("\n");
      for (const line of lines) {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const [, name] of line.matchAll(/(?<!function\s)\b(enqueueJob|emitEvent|getSendBoss)\(/g)) {
          if (name === "getSendBoss") {
            if (path !== "jobs/enqueue.ts") sendBoss.push(path);
          } else if (path !== "jobs/enqueue.ts") {
            callSites.push(`${path} ${name}`);
          }
        }
      }
    }
    const listed = PRODUCERS.flatMap((producer) => (producer.callSite ? [producer.callSite] : []));
    expect(callSites.sort()).toEqual(listed.sort());
    expect(sendBoss).toEqual([]);
  });
});

describe("the domain_event handler (worker)", () => {
  it("ignores unknown job data fields (EVT-03)", async () => {
    const eventId = await withWorkspace(workspaceA, async (tx) => {
      const id = await emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID() }));
      // Not through emitEvent: the job is sent directly with an extra field, as a later producer version might.
      return id;
    });
    await waitFor("first job completed", async () => ((await jobs({ id: eventId }))[0]?.state === "completed" ? true : undefined));
    const boss = await getSendBoss();
    const extra = await boss.send("domain_event", { workspaceId: workspaceA, eventId, addedLater: "x" });
    await waitFor("job with an extra field completed", async () =>
      (await jobs({ id: extra ?? "" }))[0]?.state === "completed" ? true : undefined,
    );
    expect(loaded.filter((seen) => seen.id === eventId)).toHaveLength(2);
  });

  it("fails a job naming another workspace: RLS hides the event, so the job retries", async () => {
    const eventId = await withWorkspace(workspaceA, (tx) => emitEvent(tx, invoiceIssued({ invoiceId: crypto.randomUUID() })));
    await waitFor("event loaded", async () => loaded.find((seen) => seen.id === eventId));
    const before = loaded.length;
    const boss = await getSendBoss();
    const crossed = await boss.send("domain_event", { workspaceId: workspaceB, eventId });
    const [job] = await waitFor("job in retry", async () => {
      const rows = await admin<{ state: string; output: { message?: string } | null }[]>`
        select state, output from pgboss.job_common where id = ${crossed ?? ""}`;
      return rows[0]?.state === "retry" ? rows : undefined;
    });
    expect(job?.output?.message).toBe("event not found");
    expect(loaded.length).toBe(before);
  });

  it("crm_app cannot read job payloads, next to the producer (Task 16)", async () => {
    const app = postgres(database.appUrl, { max: 1, onnotice: () => {} });
    try {
      const code = (promise: Promise<unknown>) => promise.then(() => "allowed", (error: { code?: string }) => error.code);
      expect(await code(app`select data from pgboss.job_common limit 1`)).toBe("42501");
      expect(await code(app`select * from pgboss.job limit 1`)).toBe("42501");
      expect(await code(app`select id from pgboss.job_common limit 1`)).toBe("allowed");
    } finally {
      await app.end();
    }
  });
});
