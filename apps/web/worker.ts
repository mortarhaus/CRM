import { openDatabase } from "./src/db/system";
import { getWorkerEnv } from "./src/lib/env";
import { startWorker } from "./src/worker/start";

async function main(): Promise<void> {
  const env = getWorkerEnv();
  // crm_app for tenant and system work (3 connections), crm_worker for pg-boss (3, WORKER_BOSS_OPTIONS).
  const appDb = openDatabase(env.DATABASE_URL, { max: 3 });
  const worker = await startWorker({ appDb, workerUrl: env.DATABASE_WORKER_URL });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void worker.stop().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
  }
}

// A start-up failure (environment, connection, authentication) carries no job data, so its message is printed.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
