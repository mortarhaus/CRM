import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { startWorker } from "./start";

let database: TestDatabase;

beforeAll(async () => {
  database = await startDatabase();
});

afterAll(async () => {
  await database?.stop();
});

describe("startWorker", () => {
  it("logs readiness once the database answers and stops cleanly", async () => {
    const lines: string[] = [];
    const worker = await startWorker(postgres(database.appUrl, { max: 2, prepare: false }), (line) => lines.push(line));
    expect(lines).toEqual([JSON.stringify({ level: "info", msg: "worker ready" })]);

    await worker.stop();
    expect(lines.at(-1)).toBe(JSON.stringify({ level: "info", msg: "worker stopped" }));
  });

  it("fails fast instead of reporting ready when the database is unreachable", async () => {
    const lines: string[] = [];
    const sql = postgres("postgres://nobody:nothing@127.0.0.1:1/none", { max: 1, connect_timeout: 2 });
    await expect(startWorker(sql, (line) => lines.push(line))).rejects.toThrow();
    expect(lines).toEqual([]);
    await sql.end();
  });
});
