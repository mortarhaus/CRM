import { PgBoss } from "pg-boss";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { SEND_BOSS_OPTIONS, WORKER_BOSS_OPTIONS } from "./options";
import { RETRY_HELP, runRetryCommand } from "./retry";

let database: TestDatabase;
let admin: postgres.Sql;
let failedId: string;
let deadCopyId: string;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  // One email.send job that fails at once (retryLimit 0): failed in email.send, a copy in email.send.dead.
  const sender = new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString: database.appUrl });
  const worker = new PgBoss({ ...WORKER_BOSS_OPTIONS, schedule: false, supervise: false, connectionString: database.workerUrl });
  await sender.start();
  await worker.start();
  failedId = (await sender.send("email.send", { workspaceId: crypto.randomUUID() }, { retryLimit: 0 })) ?? "";
  const [job] = await worker.fetch("email.send");
  await worker.fail("email.send", job?.id ?? "");
  const [copy] = await admin<{ id: string }[]>`select id from pgboss.job where name = 'email.send.dead' and source_id = ${failedId}`;
  deadCopyId = copy?.id ?? "";
  await worker.stop();
  await sender.stop();
});

afterAll(async () => {
  await admin?.end();
  await database?.stop();
});

async function run(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runRetryCommand(argv, { workerUrl: () => database.workerUrl, out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out, err };
}

const state = async (id: string) => (await admin<{ state: string }[]>`select state from pgboss.job where id = ${id}`)[0]?.state;

describe("jobs:retry (the retry admin command, EVT-05)", () => {
  it("--help says to retry the original queue and that a dead-letter retry is a no-op", async () => {
    expect(await run("--help")).toEqual({ code: 0, out: [RETRY_HELP], err: [] });
    expect(RETRY_HELP).toContain("--queue <original queue> --id <failed job id>");
    expect(RETRY_HELP).toContain("retrying it there is a no-op");
  });

  it("refuses bad arguments before connecting", async () => {
    expect((await run()).code).toBe(2);
    expect((await run("--queue", "email.send")).code).toBe(2);
    expect((await run("--queue", "email.send", "--id", "1; drop table x")).err).toEqual([
      JSON.stringify({ level: "error", msg: "--id must be a job id (a uuid)" }),
    ]);
    expect((await run("--queue", "email.send", "--id", failedId, "--force")).code).toBe(2);
  });

  it("reports a .dead copy as not found and changes nothing (retrying the dead-letter queue is a no-op)", async () => {
    expect(deadCopyId).toMatch(/^[0-9a-f-]{36}$/);
    const result = await run("--queue", "email.send.dead", "--id", deadCopyId);
    expect(result.code).toBe(1);
    expect(result.err[0]).toContain("job not found");
    expect(await state(deadCopyId)).toBe("created");
    expect(await state(failedId)).toBe("failed");
  });

  it("reports an unknown id and an unknown queue", async () => {
    expect((await run("--queue", "email.send", "--id", crypto.randomUUID())).err).toEqual([
      JSON.stringify({ level: "error", msg: "job not found", queue: "email.send" }),
    ]);
    expect((await run("--queue", "nope", "--id", failedId)).err).toEqual([
      JSON.stringify({ level: "error", msg: "queue not found", queue: "nope" }),
    ]);
  });

  it("retries the failed job in its original queue (pnpm passes a leading --)", async () => {
    expect(await run("--", "--queue", "email.send", "--id", failedId)).toEqual({
      code: 0,
      out: [JSON.stringify({ level: "info", msg: "job retried" })],
      err: [],
    });
    expect(await state(failedId)).toBe("retry");
    // A second retry finds no failed job.
    expect((await run("--queue", "email.send", "--id", failedId)).code).toBe(1);
  });
});
