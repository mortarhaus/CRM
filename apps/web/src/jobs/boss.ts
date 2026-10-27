import { PgBoss } from "pg-boss";
import { getEnv } from "../lib/env";
import { type Log, logJobError } from "./log";
import { SEND_BOSS_OPTIONS, WORKER_BOSS_OPTIONS } from "./options";

// The two pg-boss instances (spec "Domain events and jobs"; options.ts holds the locked switches). Each gets an
// `error` listener before start(): pg-boss emits `error` from its timers and pool, and an EventEmitter with no
// listener throws it, which would crash the process.

function withErrorLog(boss: PgBoss, log: Log): PgBoss {
  boss.on("error", (error) => logJobError(log, "pg-boss error", error));
  return boss;
}

export function createSendBoss(connectionString: string, log: Log = console.error): PgBoss {
  return withErrorLog(new PgBoss({ ...SEND_BOSS_OPTIONS, connectionString }), log);
}

export function createWorkerBoss(connectionString: string, log: Log = console.error): PgBoss {
  return withErrorLog(new PgBoss({ ...WORKER_BOSS_OPTIONS, connectionString }), log);
}

const globalCache = globalThis as typeof globalThis & { crmSendBoss?: Promise<PgBoss> };

// The web process's send-only instance (crm_app, DATABASE_URL), started once per process. The start promise is
// cached, so concurrent first callers share one start(); a failed start is not cached, so the next call retries.
export function getSendBoss(): Promise<PgBoss> {
  if (!globalCache.crmSendBoss) {
    const started = createSendBoss(getEnv().DATABASE_URL).start();
    globalCache.crmSendBoss = started;
    started.catch(() => {
      if (globalCache.crmSendBoss === started) globalCache.crmSendBoss = undefined;
    });
  }
  return globalCache.crmSendBoss;
}
