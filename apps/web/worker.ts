import postgres from "postgres";
import { getWorkerEnv } from "./src/lib/env";
import { startWorker } from "./src/worker/start";

async function main(): Promise<void> {
  const worker = await startWorker(postgres(getWorkerEnv().DATABASE_URL, { max: 2, prepare: false }));
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void worker.stop().then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
