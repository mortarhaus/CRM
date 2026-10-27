import { runRetryCommand } from "../src/jobs/retry";
import { getWorkerEnv } from "../src/lib/env";

// pnpm --filter @crm/web jobs:retry -- --queue <original queue> --id <failed job id>; see --help (src/jobs/retry.ts).
process.exitCode = await runRetryCommand(process.argv.slice(2), {
  workerUrl: () => getWorkerEnv().DATABASE_WORKER_URL,
  out: console.log,
  err: console.error,
});
