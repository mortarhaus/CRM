import { runRetryCommand } from "../src/jobs/retry";
import { parseJobsAdminEnv } from "../src/lib/env";

// pnpm --filter @crm/web jobs:retry -- --queue <original queue> --id <dead-letter job id>; see --help (src/jobs/retry.ts).
// No top-level await: tsx runs this package's scripts as CommonJS.
runRetryCommand(process.argv.slice(2), {
  workerUrl: () => parseJobsAdminEnv(process.env).DATABASE_WORKER_URL,
  out: console.log,
  err: console.error,
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
);
