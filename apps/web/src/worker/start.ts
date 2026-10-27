import type { AppDatabase } from "../db/system";
import { createWorkerBoss } from "../jobs/boss";
import { HANDLERS, type Handlers, type QueueName } from "../jobs/handlers";
import { type Log, logInfo } from "../jobs/log";

export interface WorkerHandle {
  stop(): Promise<void>;
}

export interface StartWorkerOptions {
  // The crm_app pool, opened by the caller with openDatabase(); the worker closes it on stop().
  appDb: AppDatabase;
  // crm_worker, direct (DATABASE_WORKER_URL): pg-boss only.
  workerUrl: string;
  log?: Log;
  // The queue handlers; tests pass stubs.
  handlers?: Handlers;
}

// Under Docker's 10 s between SIGTERM and SIGKILL: active jobs get 8 s to finish, then pg-boss fails them (they are
// retried by their queue's policy).
export const STOP_TIMEOUT_MS = 8_000;

export async function startWorker({ appDb, workerUrl, log = console.log, handlers = HANDLERS }: StartWorkerOptions): Promise<WorkerHandle> {
  const boss = createWorkerBoss(workerUrl, log);
  try {
    await appDb.ping();
    await boss.start();
    for (const [queue, handler] of Object.entries(handlers) as [QueueName, NonNullable<Handlers[QueueName]>][]) {
      await boss.work<object>(queue, (jobs) => handler(jobs, { log }));
    }
  } catch (error) {
    await boss.stop({ graceful: false, timeout: 1_000 }).catch(() => {});
    await appDb.close();
    throw error;
  }
  logInfo(log, "worker ready");
  return {
    async stop() {
      await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
      await appDb.close();
      logInfo(log, "worker stopped");
    },
  };
}
