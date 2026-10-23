import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { createDb, type DbHandle } from "./client";

let database: TestDatabase;
let handle: DbHandle;

beforeAll(async () => {
  database = await startDatabase();
  handle = createDb(database.appUrl);
});

afterAll(async () => {
  await handle?.sql.end();
  await database?.stop();
});

describe("createDb", () => {
  it("runs queries over the postgres TCP driver as crm_app", async () => {
    const rows = await handle.sql<{ ok: number; user: string }[]>`select 1 as ok, current_user as user`;
    expect(rows[0]).toEqual({ ok: 1, user: "crm_app" });
  });

  it("exposes a Drizzle instance on the same pool", async () => {
    // drizzle-orm 0.45.3's postgres-js driver leaves timestamptz unparsed in raw execute(), so now() is a string.
    const rows = await handle.db.execute<{ now: string }>(sql`select now() as now`);
    expect(typeof rows[0]?.now).toBe("string");
    expect(rows[0]?.now).toMatch(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/);
  });
});
