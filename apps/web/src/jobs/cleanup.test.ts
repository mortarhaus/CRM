import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, openDatabase } from "../db/system";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { startWorker } from "../worker/start";
import {
  IDEMPOTENCY_CLEANUP_CRON,
  idempotencyCleanupHandler,
  RATE_LIMIT_CLEANUP_CRON,
  rateLimitCleanupHandler,
} from "./cleanup";

// Plan Task 24 Steps 3 and 4 (EVT-06): the two daily cleanups, worker-owned, as crm_app through the system module
// and withWorkspace, with no HTTP trigger.

let database: TestDatabase;
let admin: postgres.Sql;
let appDb: AppDatabase;
const log = () => {};

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 2, onnotice: () => {} });
});

afterAll(async () => {
  await appDb?.close().catch(() => {});
  await admin?.end();
  await database?.stop();
});

beforeEach(async () => {
  await appDb?.close().catch(() => {});
  appDb = openDatabase(database.appUrl, { max: 2 });
  await admin`delete from rate_limit`;
  await admin`delete from idempotency_key`;
});

async function workspace(): Promise<string> {
  const id = randomUUID();
  await admin`insert into organization (id, name, slug, created_at) values (${id}, 'Cleanup', ${`cleanup-${id}`}, now())`;
  return id;
}

async function idempotencyRow(workspaceId: string, key: string, expiresAt: string): Promise<void> {
  await admin`
    insert into idempotency_key (workspace_id, key, action, request_hash, expires_at)
    values (${workspaceId}, ${key}, 'test', '\\x00'::bytea, ${expiresAt}::timestamptz)`;
}

describe("rate_limit.cleanup", () => {
  it("deletes only the counter rows whose window ended more than a day ago", async () => {
    await admin`
      insert into rate_limit (key, count, window_start, window_seconds) values
        ('ba:sign-in:203.0.113.1', 3, now() - interval '2 days', 60),
        ('ba:sign-up:203.0.113.1', 3, now() - interval '25 hours', 3600),
        ('ba:sign-in:203.0.113.2', 3, now() - interval '23 hours', 60),
        ('acct:signin:live', 1, now(), 900)`;
    await rateLimitCleanupHandler()([], { log });
    const keys = (await admin<{ key: string }[]>`select key from rate_limit order by key`).map((row) => row.key);
    expect(keys).toEqual(["acct:signin:live", "ba:sign-in:203.0.113.2"]);
  });
});

describe("idempotency.cleanup", () => {
  it("deletes only expired idempotency rows, in every workspace", async () => {
    const [w1, w2, w3] = [await workspace(), await workspace(), await workspace()];
    for (const id of [w1, w2]) {
      await idempotencyRow(id, "old", new Date(Date.now() - 60_000).toISOString());
      await idempotencyRow(id, "live", new Date(Date.now() + 3_600_000).toISOString());
    }
    await idempotencyRow(w3, "live", new Date(Date.now() + 3_600_000).toISOString());
    await idempotencyCleanupHandler()([], { log });
    const rows = await admin<{ workspace_id: string; key: string }[]>`
      select workspace_id, key from idempotency_key order by workspace_id, key`;
    expect(rows.map((row) => `${row.workspace_id}:${row.key}`).sort()).toEqual(
      [`${w1}:live`, `${w2}:live`, `${w3}:live`].sort(),
    );
  });

  it("one workspace's transaction deletes nothing of another (RLS on idempotency_key)", async () => {
    const [w1, w2] = [await workspace(), await workspace()];
    await idempotencyRow(w1, "old", new Date(Date.now() - 60_000).toISOString());
    await idempotencyRow(w2, "old", new Date(Date.now() - 60_000).toISOString());
    const { deleteExpiredIdempotencyKeys } = await import("./cleanup");
    expect(await deleteExpiredIdempotencyKeys(w1)).toBe(1);
    const left = await admin<{ workspace_id: string }[]>`select workspace_id from idempotency_key`;
    expect(left.map((row) => row.workspace_id)).toEqual([w2]);
  });
});

describe("the schedules", () => {
  it("startWorker registers both, daily at fixed UTC minutes", async () => {
    const worker = await startWorker({ appDb, workerUrl: database.workerUrl, log, handlers: {} });
    try {
      const rows = await admin<{ name: string; cron: string; timezone: string | null }[]>`
        select name, cron, timezone from pgboss.schedule order by name`;
      expect(rows.map(({ name, cron }) => ({ name, cron }))).toEqual([
        { name: "idempotency.cleanup", cron: IDEMPOTENCY_CLEANUP_CRON },
        { name: "rate_limit.cleanup", cron: RATE_LIMIT_CLEANUP_CRON },
      ]);
      for (const row of rows) expect(row.timezone ?? "UTC").toBe("UTC");
    } finally {
      await worker.stop();
    }
  });

  it("no HTTP route imports the cleanup jobs (no HTTP trigger)", () => {
    const appDir = fileURLToPath(new URL("../app", import.meta.url));
    const routes = readdirSync(appDir, { recursive: true, encoding: "utf8" }).filter((file) => path.basename(file) === "route.ts");
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(readFileSync(path.join(appDir, route), "utf8"), route).not.toMatch(/jobs\/cleanup/);
    }
  });
});
