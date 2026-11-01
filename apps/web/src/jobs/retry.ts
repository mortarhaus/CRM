import { parseArgs } from "node:util";
import { PgBoss } from "pg-boss";
import { z } from "zod";
import { type Log, logJobError } from "./log";
import { RETRY_BOSS_OPTIONS } from "./options";

// The retry admin command (EVT-05; plan Task 18): runs a dead-lettered job again. A job whose retries are exhausted
// is `failed` in its queue (pg-boss deletes it after the queue's deleteAfterSeconds, 7 days by default) and a copy
// lands in the queue's dead-letter queue in state `created`. pg-boss's redrive() moves that copy: it creates a new job
// in the copy's source queue (new id, retry_count 0, the queue's current retry settings) and deletes the copy, in one
// statement. retry() on the failed original stopped working once it was deleted and left the copy behind (PR 45
// deferred P2-1), so the command takes the copy's id.
export const RETRY_HELP = `Usage: pnpm --filter @crm/web jobs:retry -- --queue <original queue> --id <dead-letter job id>

Runs a dead-lettered pg-boss job again, as crm_worker (DATABASE_WORKER_URL): pg-boss redrive() moves the copy from
the queue's dead-letter queue back to the queue as a new job (new id, retry_count 0) and deletes the copy.

  --queue  The queue the job failed in, for example email.send or domain_event (not the .dead queue).
  --id     The id of the job's copy in that queue's dead-letter queue (email.send.dead, domain_event.dead).
  --help   Show this text.

The failed original's id is not accepted: it stays failed until pg-boss deletes it. Do not also retry it, or the
job runs twice.`;

const MISSING = "use --queue <original queue> --id <dead-letter job id> (see --help)";

export interface RetryCommandIo {
  workerUrl: () => string;
  out: Log;
  err: Log;
}

// Exit code: 0 redriven (or --help), 1 not redriven, 2 bad arguments.
export async function runRetryCommand(argv: readonly string[], io: RetryCommandIo): Promise<number> {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let values: { queue?: string; id?: string; help?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: { queue: { type: "string" }, id: { type: "string" }, help: { type: "boolean", short: "h" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch {
    io.err(JSON.stringify({ level: "error", msg: MISSING }));
    return 2;
  }
  if (values.help) {
    io.out(RETRY_HELP);
    return 0;
  }
  if (!values.queue || !values.id) {
    io.err(JSON.stringify({ level: "error", msg: MISSING }));
    return 2;
  }
  if (!z.uuid().safeParse(values.id).success) {
    io.err(JSON.stringify({ level: "error", msg: "--id must be a job id (a uuid)" }));
    return 2;
  }

  const boss = new PgBoss({ ...RETRY_BOSS_OPTIONS, connectionString: io.workerUrl() });
  boss.on("error", (error) => logJobError(io.err, "pg-boss error", error));
  try {
    await boss.start();
    const queue = await boss.getQueue(values.queue);
    if (!queue) {
      io.err(JSON.stringify({ level: "error", msg: "queue not found", queue: values.queue }));
      return 1;
    }
    if (!queue.deadLetter) {
      io.err(
        JSON.stringify({ level: "error", msg: "queue has no dead-letter queue; pass the original queue", queue: values.queue }),
      );
      return 1;
    }
    // No destination: the new job goes to the copy's source queue. sourceName keeps a copy from another queue (one
    // dead-letter queue can collect from several) from moving under this queue's name.
    const moved = await boss.redrive(queue.deadLetter, { ids: [values.id], sourceName: values.queue, limit: 1 });
    if (moved !== 1) {
      io.err(
        JSON.stringify({
          level: "error",
          msg: "job not found; pass the id of the copy in the dead-letter queue (see --help)",
          queue: values.queue,
        }),
      );
      return 1;
    }
    io.out(JSON.stringify({ level: "info", msg: "job redriven", queue: values.queue }));
    return 0;
  } catch (error) {
    logJobError(io.err, "retry failed", error);
    return 1;
  } finally {
    await boss.stop({ graceful: false, timeout: 1_000 }).catch(() => {});
  }
}
