import { getDb } from "../index";

// The pg-boss schema version migration 0015 installs (pg-boss 12.35.0; lib/health.test.ts checks it against the
// installed package's dist/schema.json).
export const PGBOSS_SCHEMA_VERSION = 43;

export async function pingDatabase(): Promise<void> {
  await getDb().sql`select 1`;
}

// The queue is usable by crm_app: the pg-boss schema is there, readable, and at the version this build expects.
export async function pingQueue(): Promise<void> {
  const [row] = await getDb().sql<{ version: number }[]>`select version from pgboss.version`;
  if (row?.version !== PGBOSS_SCHEMA_VERSION) throw new Error("unexpected pg-boss schema version");
}
