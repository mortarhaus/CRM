import { PgBoss } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { SEND_BOSS_OPTIONS, WORKER_BOSS_OPTIONS } from "./options";
import { RETRY_HELP, runRetryCommand } from "./retry";

// A payload value that must never reach the command's output (UNI-09).
const SECRET = "payload-secret-6f1d";

let database: TestDatabase;
let admin: postgres.Sql;
let sender: PgBoss;
let worker: PgBoss;
const lines: string[] = [];

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  sender = new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString: database.appUrl });
  worker = new PgBoss({ ...WORKER_BOSS_OPTIONS, schedule: false, supervise: false, connectionString: database.workerUrl });
  await sender.start();
  await worker.start();
});

afterAll(async () => {
  await worker?.stop();
  await sender?.stop();
  await admin?.end();
  await database?.stop();
});

// One job that exhausts its retries (retryLimit 0, failed at once): failed in `queue`, a copy in `queue`.dead.
// Each job outranks the earlier ones, so fetch() takes it and not a job an earlier test redrove into the queue.
let priority = 0;
async function deadLetter(queue: "email.send" | "domain_event") {
  priority += 1;
  const failedId =
    (await sender.send(queue, { workspaceId: crypto.randomUUID(), secret: SECRET }, { retryLimit: 0, priority })) ?? "";
  const [job] = await worker.fetch(queue);
  expect(job?.id).toBe(failedId);
  await worker.fail(queue, failedId);
  const [copy] = await admin<{ id: string }[]>`select id from pgboss.job where name = ${`${queue}.dead`} and source_id = ${failedId}`;
  return { failedId, copyId: copy?.id ?? "" };
}

async function run(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runRetryCommand(argv, { workerUrl: () => database.workerUrl, out: (l) => out.push(l), err: (l) => err.push(l) });
  lines.push(...out, ...err);
  return { code, out, err };
}

const job = async (id: string) =>
  (await admin<{ name: string; state: string }[]>`select name, state from pgboss.job where id = ${id}`)[0];
// The job a redrive creates: a new id in the source queue, found by the chain's first job (source_root_id).
const redriven = (failedId: string) =>
  admin<{ id: string; state: string; retry_count: number }[]>`
    select id, state, retry_count from pgboss.job where name in ('email.send', 'domain_event') and source_root_id = ${failedId}`;

describe("jobs:retry (the retry admin command, EVT-05): redrives a dead-letter copy", () => {
  it("--help says to pass the original queue and the dead-letter copy's id", async () => {
    expect(await run("--help")).toEqual({ code: 0, out: [RETRY_HELP], err: [] });
    expect(RETRY_HELP).toContain("--queue <original queue> --id <dead-letter job id>");
    expect(RETRY_HELP).toContain("redrive");
  });

  it("refuses bad arguments before connecting", async () => {
    expect((await run()).code).toBe(2);
    expect((await run("--queue", "email.send")).code).toBe(2);
    expect((await run("--id", crypto.randomUUID())).code).toBe(2);
    expect((await run("--queue", "email.send", "--id", "1; drop table x")).err).toEqual([
      JSON.stringify({ level: "error", msg: "--id must be a job id (a uuid)" }),
    ]);
    expect((await run("--queue", "email.send", "--id", crypto.randomUUID(), "--force")).code).toBe(2);
  });

  it("re-queues the copy as a new job in the original queue and removes the copy (pnpm passes a leading --)", async () => {
    const { failedId, copyId } = await deadLetter("email.send");
    expect(await job(copyId)).toEqual({ name: "email.send.dead", state: "created" });
    expect(await run("--", "--queue", "email.send", "--id", copyId)).toEqual({
      code: 0,
      out: [JSON.stringify({ level: "info", msg: "job redriven", queue: "email.send" })],
      err: [],
    });
    expect(await job(copyId)).toBeUndefined();
    const [created, ...more] = await redriven(failedId);
    expect(more).toEqual([]);
    expect(created).toMatchObject({ state: "created", retry_count: 0 });
    expect(created?.id).not.toBe(failedId);
    // The failed original is left alone (maintenance deletes it); a second run finds no copy.
    expect((await job(failedId))?.state).toBe("failed");
    expect((await run("--queue", "email.send", "--id", copyId)).code).toBe(1);
    expect(await redriven(failedId)).toHaveLength(1);
  });

  it("works after the failed original is gone (pg-boss deletes it after deleteAfterSeconds)", async () => {
    const { failedId, copyId } = await deadLetter("domain_event");
    await admin`delete from pgboss.job where id = ${failedId}`;
    expect((await run("--queue", "domain_event", "--id", copyId)).code).toBe(0);
    expect(await job(copyId)).toBeUndefined();
    expect((await redriven(failedId)).map((row) => row.state)).toEqual(["created"]);
  });

  it("refuses the failed original's id, an unknown id, and another queue's copy, and changes nothing", async () => {
    const { failedId, copyId } = await deadLetter("email.send");
    const notFound = JSON.stringify({
      level: "error",
      msg: "job not found; pass the id of the copy in the dead-letter queue (see --help)",
      queue: "email.send",
    });
    expect(await run("--queue", "email.send", "--id", failedId)).toEqual({ code: 1, out: [], err: [notFound] });
    expect((await run("--queue", "email.send", "--id", crypto.randomUUID())).err).toEqual([notFound]);
    // The email.send.dead copy, named with another queue: sourceName does not match, nothing moves.
    expect((await run("--queue", "domain_event", "--id", copyId)).code).toBe(1);
    expect(await job(copyId)).toEqual({ name: "email.send.dead", state: "created" });
    expect((await job(failedId))?.state).toBe("failed");
    expect(await redriven(failedId)).toEqual([]);
  });

  it("moves only copies from the named queue when a dead-letter queue collects from several", async () => {
    // A test-only queue sharing email.send.dead (queues are created in migrations; admin here).
    await admin`select pgboss.create_queue('shares.dead', '{"policy":"standard","deadLetter":"email.send.dead"}'::jsonb)`;
    const failedId = (await sender.send("shares.dead", { secret: SECRET }, { retryLimit: 0 })) ?? "";
    await worker.fetch("shares.dead");
    await worker.fail("shares.dead", failedId);
    const [copy] = await admin<{ id: string }[]>`select id from pgboss.job where name = 'email.send.dead' and source_id = ${failedId}`;
    const copyId = copy?.id ?? "";
    expect((await run("--queue", "email.send", "--id", copyId)).code).toBe(1);
    expect(await job(copyId)).toEqual({ name: "email.send.dead", state: "created" });
    expect((await run("--queue", "shares.dead", "--id", copyId)).code).toBe(0);
    expect(await job(copyId)).toBeUndefined();
  });

  it("refuses an unknown queue and a queue with no dead-letter queue", async () => {
    const { copyId } = await deadLetter("email.send");
    expect(await run("--queue", "nope", "--id", copyId)).toEqual({
      code: 1,
      out: [],
      err: [JSON.stringify({ level: "error", msg: "queue not found", queue: "nope" })],
    });
    for (const queue of ["email.send.dead", "rate_limit.cleanup"]) {
      expect(await run("--queue", queue, "--id", copyId)).toEqual({
        code: 1,
        out: [],
        err: [JSON.stringify({ level: "error", msg: "queue has no dead-letter queue; pass the original queue", queue })],
      });
    }
    expect(await job(copyId)).toEqual({ name: "email.send.dead", state: "created" });
  });

  it("never prints a payload value (UNI-09)", () => {
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.join("\n")).not.toContain(SECRET);
  });
});
