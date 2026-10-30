import { createRequire } from "node:module";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGBOSS_SCHEMA_VERSION, pingQueue } from "../db/system";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { checkHealth } from "./health";

let databaseUrl = "";
vi.mock("./env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));

const ok = async () => {};

describe("checkHealth", () => {
  it("reports ok when the database and the queue answer", async () => {
    await expect(checkHealth(ok, ok)).resolves.toEqual({
      status: 200,
      body: { status: "ok", db: "ok", queue: "ok" },
    });
  });

  it("reports 503 without leaking the database error", async () => {
    const result = await checkHealth(async () => {
      throw new Error('password authentication failed for user "crm"');
    }, ok);
    expect(result).toEqual({ status: 503, body: { status: "error", db: "error", queue: "ok" } });
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("reports 503 with queue: error, never the error text, when the queue check fails", async () => {
    const result = await checkHealth(ok, async () => {
      throw new Error('relation "pgboss.version" does not exist');
    });
    expect(result).toEqual({ status: 503, body: { status: "error", db: "ok", queue: "error" } });
    expect(JSON.stringify(result)).not.toContain("pgboss");
  });

  it("reports 503 when the database or the queue does not answer in time", async () => {
    const never = () => new Promise<void>(() => {});
    expect((await checkHealth(never, ok, 50)).body).toEqual({ status: "error", db: "error", queue: "ok" });
    expect((await checkHealth(ok, never, 50)).body).toEqual({ status: "error", db: "ok", queue: "error" });
  });
});

describe("pingQueue (crm_app reads pgboss.version)", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await startDatabase();
    databaseUrl = database.appUrl;
  });

  afterAll(async () => {
    const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
    await cache.crmDb?.sql.end();
    cache.crmDb = undefined;
    await database?.stop();
  });

  it("expects the schema version of the installed pg-boss", () => {
    const manifest = createRequire(import.meta.url)("pg-boss/dist/schema.json") as { version: number };
    expect(PGBOSS_SCHEMA_VERSION).toBe(manifest.version);
  });

  it("succeeds as crm_app on the migrated database, and fails on another version", async () => {
    await expect(pingQueue()).resolves.toBeUndefined();
    const admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
    try {
      await admin`update pgboss.version set version = version + 1`;
      await expect(pingQueue()).rejects.toThrow();
      await admin`update pgboss.version set version = version - 1`;
    } finally {
      await admin.end();
    }
  });
});
