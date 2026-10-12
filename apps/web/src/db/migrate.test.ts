import { readFileSync } from "node:fs";
import path from "node:path";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { getTableName } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_DIR, startPostgres } from "../test/postgres";
import { runMigrations } from "./migrate";
import { account, invitation, member, organization, session, twoFactor, user, verification } from "./schema";

let container: StartedPostgreSqlContainer;
let url: string;

beforeAll(async () => {
  container = await startPostgres();
  url = container.getConnectionUri();
});

afterAll(async () => {
  await container?.stop();
});

function journalLength(): number {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8")) as {
    entries: unknown[];
  };
  return journal.entries.length;
}

async function appliedCount(): Promise<number> {
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{ count: number }[]>`select count(*)::int as count from drizzle.__drizzle_migrations`;
    return rows[0]?.count ?? 0;
  } finally {
    await sql.end();
  }
}

describe("runMigrations", () => {
  it("brings an empty database to the latest schema when web and worker start at the same time", async () => {
    await Promise.all([runMigrations(url, MIGRATIONS_DIR), runMigrations(url, MIGRATIONS_DIR)]);

    const sql = postgres(url, { max: 1 });
    try {
      const tables = await sql<{ name: string }[]>`
        select table_name as name from information_schema.tables where table_schema = 'public'`;
      const names = tables.map((row) => row.name);
      for (const table of [user, session, account, verification, twoFactor, organization, member, invitation]) {
        expect(names).toContain(getTableName(table));
      }

      const naiveTimestamps = await sql<{ column: string }[]>`
        select table_name || '.' || column_name as column from information_schema.columns
        where table_schema = 'public' and data_type = 'timestamp without time zone'`;
      expect([...naiveTimestamps]).toEqual([]);
    } finally {
      await sql.end();
    }

    expect(await appliedCount()).toBe(journalLength());
  });

  it("is a no-op when run again on an up-to-date database", async () => {
    await runMigrations(url, MIGRATIONS_DIR);
    expect(await appliedCount()).toBe(journalLength());
  });
});
