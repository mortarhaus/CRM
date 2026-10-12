import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, options: { max?: number } = {}) {
  // Phase 1+ connects through a transaction-mode pooler, where server-side prepared statements break (spec v4.5, Spike 1).
  const sql = postgres(url, { max: options.max ?? 10, prepare: false });
  const db = drizzle({ client: sql, schema });
  return { sql, db };
}

export type DbHandle = ReturnType<typeof createDb>;
export type Database = DbHandle["db"];
