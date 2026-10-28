import { parseArgs } from "node:util";
import { PgBoss } from "pg-boss";
import { z } from "zod";
import { type Log, logJobError } from "./log";
import { RETRY_BOSS_OPTIONS } from "./options";

// The retry admin command (EVT-05; plan Task 18): puts a failed job back in its queue. pg-boss's retry() matches
// only jobs in state `failed`. The copy a dead-letter queue holds is a new job in state `created`, not a failed
// one, so retrying it changes nothing: retry the failed original in its own queue.
export const RETRY_HELP = `Usage: pnpm --filter @crm/web jobs:retry -- --queue <original queue> --id <failed job id>

Retries a failed pg-boss job, as crm_worker (DATABASE_WORKER_URL).

  --queue  The queue the job failed in, for example email.send or domain_event.
  --id     The id of the failed job in that queue (pgboss.job_common.id, state failed).
  --help   Show this text.

A job in a dead-letter queue (email.send.dead, domain_event.dead) is a copy in state created, not a failed job:
retrying it there is a no-op and reports "job not found". Find the original by the copy's source_id and retry
that id in the original queue.`;

const MISSING = "use --queue <original queue> --id <failed job id> (see --help)";

export interface RetryCommandIo {
  workerUrl: () => string;
  out: Log;
  err: Log;
}

// Exit code: 0 retried (or --help), 1 not retried, 2 bad arguments.
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
    if (!(await boss.getQueue(values.queue))) {
      io.err(JSON.stringify({ level: "error", msg: "queue not found", queue: values.queue }));
      return 1;
    }
    // 12.35.0 types CommandResponse as an empty interface; at runtime it is { jobs, requested, affected }.
    const { affected } = (await boss.retry(values.queue, values.id)) as { affected?: number };
    if (affected !== 1) {
      const hint = values.queue.endsWith(".dead") ? "; a dead-letter copy is not a failed job, retry the original queue" : "";
      io.err(JSON.stringify({ level: "error", msg: `job not found${hint}`, queue: values.queue }));
      return 1;
    }
    io.out(JSON.stringify({ level: "info", msg: "job retried" }));
    return 0;
  } catch (error) {
    logJobError(io.err, "retry failed", error);
    return 1;
  } finally {
    await boss.stop({ graceful: false, timeout: 1_000 }).catch(() => {});
  }
}
