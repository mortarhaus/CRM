import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { cleanupExpired, consume, giveBack } from "./rate-limit";

// Plan Task 21 Step 3: the database rate-limit counter (spec "Rate limits", AUTH-06). Runs as crm_app.

let database: TestDatabase;
let pool1: DbHandle;
let pool2: DbHandle;
let admin: postgres.Sql;

beforeAll(async () => {
  database = await startDatabase();
  pool1 = createDb(database.appUrl, { max: 10 });
  pool2 = createDb(database.appUrl, { max: 10 });
  admin = postgres(database.adminUrl, { max: 1 });
});

afterAll(async () => {
  await pool1?.sql.end({ timeout: 1 });
  await pool2?.sql.end({ timeout: 1 });
  await admin?.end();
  await database?.stop();
});

beforeEach(async () => {
  await admin`delete from rate_limit`;
});

const T0 = new Date("2026-11-01T10:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

async function row(key: string) {
  const [found] = await admin<{ count: number; window_start: Date; window_seconds: number }[]>`
    select count, window_start, window_seconds from rate_limit where key = ${key}`;
  return found;
}

describe("consume", () => {
  it("grants exactly max in one window and refuses the next with a retry time", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await consume(pool1.db, "ba:one", 3, 60, at(i));
      expect(result.allowed).toBe(true);
    }
    const refused = await consume(pool1.db, "ba:one", 3, 60, at(10));
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 50 });
    expect((await row("ba:one"))?.count).toBe(3);
  });

  it("uses clock_timestamp() when no time is passed, and still gives a positive retry time", async () => {
    await consume(pool1.db, "ba:now", 1, 60, null);
    const refused = await consume(pool1.db, "ba:now", 1, 60, null);
    if (refused.allowed) throw new Error("expected a refusal");
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("starts a new window after window_seconds", async () => {
    await consume(pool1.db, "ba:roll", 1, 60, at(0));
    expect((await consume(pool1.db, "ba:roll", 1, 60, at(59))).allowed).toBe(false);
    const next = await consume(pool1.db, "ba:roll", 1, 60, at(60));
    expect(next.allowed).toBe(true);
    const stored = await row("ba:roll");
    expect(stored?.count).toBe(1);
    expect(stored?.window_start.toISOString()).toBe(at(60).toISOString());
  });

  it("grants exactly one of 50 parallel calls from two pools when the count is at max - 1", async () => {
    await admin`insert into rate_limit (key, count, window_start, window_seconds) values ('ba:race', 9, ${T0}, 60)`;
    const calls = Array.from({ length: 50 }, (_, i) =>
      consume((i % 2 === 0 ? pool1 : pool2).db, "ba:race", 10, 60, at(1)),
    );
    const results = await Promise.all(calls);
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect((await row("ba:race"))?.count).toBe(10);
  });

  it("starts the new window once when 20 parallel calls arrive after the window ended", async () => {
    await admin`insert into rate_limit (key, count, window_start, window_seconds) values ('ba:edge', 10, ${T0}, 60)`;
    const calls = Array.from({ length: 20 }, (_, i) =>
      consume((i % 2 === 0 ? pool1 : pool2).db, "ba:edge", 10, 60, at(61)),
    );
    const results = await Promise.all(calls);
    const granted = results.filter((result) => result.allowed);
    expect(granted).toHaveLength(10);
    const stored = await row("ba:edge");
    expect(stored?.count).toBe(granted.length);
    expect(stored?.window_start.toISOString()).toBe(at(61).toISOString());
    expect(new Set(granted.map((result) => (result.allowed ? result.windowStart : null))).size).toBe(1);
  });

  it("keeps a counter written by one pool for a new pool (restart)", async () => {
    await consume(pool1.db, "ba:keep", 2, 60, at(0));
    await consume(pool1.db, "ba:keep", 2, 60, at(1));
    const fresh = createDb(database.appUrl, { max: 1 });
    try {
      expect((await consume(fresh.db, "ba:keep", 2, 60, at(2))).allowed).toBe(false);
    } finally {
      await fresh.sql.end({ timeout: 1 });
    }
  });
});

describe("giveBack", () => {
  it("decrements the count of the reserved window only", async () => {
    const granted = await consume(pool1.db, "acct:give", 5, 900, at(0));
    await consume(pool1.db, "acct:give", 5, 900, at(1));
    expect(granted.allowed).toBe(true);
    if (!granted.allowed) return;
    await giveBack(pool1.db, "acct:give", granted.windowStart);
    expect((await row("acct:give"))?.count).toBe(1);
  });

  it("changes nothing after the window rolled", async () => {
    const granted = await consume(pool1.db, "acct:rolled", 5, 60, at(0));
    if (!granted.allowed) throw new Error("expected a grant");
    await consume(pool1.db, "acct:rolled", 5, 60, at(120));
    await giveBack(pool1.db, "acct:rolled", granted.windowStart);
    const stored = await row("acct:rolled");
    expect(stored?.count).toBe(1);
    expect(stored?.window_start.toISOString()).toBe(at(120).toISOString());
  });

  it("never takes the count below zero", async () => {
    const granted = await consume(pool1.db, "acct:zero", 5, 60, at(0));
    if (!granted.allowed) throw new Error("expected a grant");
    await giveBack(pool1.db, "acct:zero", granted.windowStart);
    await giveBack(pool1.db, "acct:zero", granted.windowStart);
    expect((await row("acct:zero"))?.count).toBe(0);
  });

  it("matches a window start with sub-millisecond precision from clock_timestamp()", async () => {
    const granted = await consume(pool1.db, "acct:micro", 5, 60, null);
    if (!granted.allowed) throw new Error("expected a grant");
    await giveBack(pool1.db, "acct:micro", granted.windowStart);
    expect((await row("acct:micro"))?.count).toBe(0);
  });
});

describe("cleanupExpired", () => {
  it("deletes only rows whose window ended more than 24 hours ago", async () => {
    await admin`insert into rate_limit (key, count, window_start, window_seconds) values
      ('ba:old', 1, ${T0}, 60),
      ('ba:recent', 1, ${at(3600)}, 60),
      ('ba:long', 1, ${T0}, 7200)`;
    // now = T0 + 60 s + 24 h + 1 s: ba:old ended 24 h + 1 s ago, ba:long ended less than 24 h ago.
    const deleted = await cleanupExpired(pool1.db, at(60 + 86_400 + 1));
    expect(deleted).toBe(1);
    const left = await admin<{ key: string }[]>`select key from rate_limit order by key`;
    expect(left.map((r) => r.key)).toEqual(["ba:long", "ba:recent"]);
  });

  it("keeps a row whose window ended exactly 24 hours ago", async () => {
    await admin`insert into rate_limit (key, count, window_start, window_seconds) values ('ba:edge', 1, ${T0}, 60)`;
    expect(await cleanupExpired(pool1.db, at(60 + 86_400))).toBe(0);
  });
});
