import { getConstructionPlans } from "pg-boss";

export const PGBOSS_SCHEMA = "pgboss";

export const PGBOSS_INSTALL_HEADER =
  '-- pg-boss 12.35.0 getConstructionPlans("pgboss"); regenerate only with a planned pg-boss upgrade (getMigrationPlans).';

// The construction plan is a BEGIN ... COMMIT script for a standalone run. The migration runner already holds one
// transaction for every pending migration, so the wrapper and its two SET LOCAL lines (which would otherwise hold
// for every later migration of the batch) are removed; every other line is pg-boss's own text.
const WRAPPER = [/^\s*BEGIN;\s*$/, /^\s*SET LOCAL lock_timeout = \d+;\s*$/, /^\s*SET LOCAL idle_in_transaction_session_timeout = \d+;\s*$/];

export function pgbossInstallSql(): string {
  const lines = getConstructionPlans(PGBOSS_SCHEMA, { createSchema: true }).split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  for (const pattern of WRAPPER) {
    const line = lines.shift();
    if (line === undefined || !pattern.test(line)) throw new Error(`unexpected construction plan line: ${line ?? "<end>"}`);
  }
  const last = lines.pop();
  if (last === undefined || !/^\s*COMMIT;\s*$/.test(last)) throw new Error(`unexpected construction plan end: ${last ?? "<end>"}`);
  if (lines.some((line) => /^\s*(BEGIN|COMMIT|ROLLBACK);\s*$/i.test(line))) throw new Error("nested transaction control");
  return [PGBOSS_INSTALL_HEADER, ...lines, ""].join("\n");
}
