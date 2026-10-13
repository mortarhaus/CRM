import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres } from "../test/postgres";
import { createDb, type DbHandle } from "./client";

let container: StartedPostgreSqlContainer;
let handle: DbHandle;

beforeAll(async () => {
  container = await startPostgres();
  handle = createDb(container.getConnectionUri());
});

afterAll(async () => {
  await handle?.sql.end();
  await container?.stop();
});

describe("createDb", () => {
  it("runs queries over the postgres TCP driver", async () => {
    const rows = await handle.sql<{ ok: number }[]>`select 1 as ok`;
    expect(rows[0]?.ok).toBe(1);
  });

  it("exposes a Drizzle instance on the same pool", async () => {
    // drizzle-orm 0.45.3's postgres-js driver leaves timestamptz unparsed in raw execute(), so now() is a string.
    const rows = await handle.db.execute<{ now: string }>(sql`select now() as now`);
    expect(typeof rows[0]?.now).toBe("string");
    expect(rows[0]?.now).toMatch(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
  });
});
