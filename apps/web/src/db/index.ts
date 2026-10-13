import { getEnv } from "../lib/env";
import { createDb, type DbHandle } from "./client";

const globalCache = globalThis as typeof globalThis & { crmDb?: DbHandle };

// Next dev re-evaluates modules on edit; caching on globalThis keeps one pool per process.
export function getDb(): DbHandle {
  globalCache.crmDb ??= createDb(getEnv().DATABASE_URL);
  return globalCache.crmDb;
}
