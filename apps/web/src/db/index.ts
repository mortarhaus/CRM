import { getEnv } from "../lib/env";
import { createDb, type DbHandle } from "./client";

const globalCache = globalThis as typeof globalThis & { crmDb?: DbHandle; crmLimiterDb?: DbHandle };

// Next dev re-evaluates modules on edit; caching on globalThis keeps one pool per process.
export function getDb(): DbHandle {
  globalCache.crmDb ??= createDb(getEnv().DATABASE_URL);
  return globalCache.crmDb;
}

// The rate limiter's own crm_app pool (Charlie 2026-11-01, decision 1 A; DECISIONS "Phase 1 PR 7"): each consume is
// one autocommit statement, so a counter row is locked only for that statement, never for a whole auth request
// transaction. Counted in the connection budget (R4): a web process holds 10 + 2 (pg-boss) + LIMITER_POOL_MAX.
export const LIMITER_POOL_MAX = 2;

export function getLimiterDb(): DbHandle {
  globalCache.crmLimiterDb ??= createDb(getEnv().DATABASE_URL, { max: LIMITER_POOL_MAX });
  return globalCache.crmLimiterDb;
}

// The crm_app pool of a process that is not the web server (the worker): what getDb() returns, opened with the
// process's own size before anything calls getDb(), so withWorkspace() and the system module use it and the process
// holds one pool (connection budget, R4). The handle lets the process check and close the pool, nothing else: no
// query goes through it (TEN-10).
export interface AppDatabase {
  ping(): Promise<void>;
  close(): Promise<void>;
}

export class DatabaseAlreadyOpenError extends Error {
  override readonly name = "DatabaseAlreadyOpenError";

  constructor() {
    super("the crm_app pool is already open in this process");
  }
}

export function openDatabase(url: string, options: { max: number }): AppDatabase {
  if (globalCache.crmDb) throw new DatabaseAlreadyOpenError();
  const handle = createDb(url, { max: options.max });
  globalCache.crmDb = handle;
  return {
    async ping() {
      await handle.sql`select 1`;
    },
    // At most 2 s: a query still running then is cancelled, so the worker's stop() stays under Docker's 10 s.
    async close() {
      if (globalCache.crmDb === handle) globalCache.crmDb = undefined;
      await handle.sql.end({ timeout: 2 });
    },
  };
}
