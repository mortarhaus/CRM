import { MissingCodeError, PeriodBehindError } from "@crm/core/numbering";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";
import { allocateNumber, previewNumber } from "./allocate";
import { type Clock, databaseClock } from "./clock";
import { updateSequence } from "./sequence";
import { startNumberingDb, type NumberingTestDb } from "../../test/numbering-db";

// Phase 2 plan Task 18: the allocator as crm_app under RLS. Period resets at the workspace time zone's boundaries
// (REC-08), no gap after a rollback (REC-07), two-workspace isolation, and the lock scope.
let db: NumberingTestDb;
let handle: DbHandle;
let actor: string;

// A clock that always reads `at`: the allocator still reads it after the row lock.
const fixed = (at: Date): Clock => async () => at;
const allocate = (workspaceId: string, at: Date) =>
  runInWorkspace(handle.db, workspaceId, async (tx) => (await allocateNumber(tx, "invoice", { clock: fixed(at) })).number);
const preview = (workspaceId: string, at: Date) => runInWorkspace(handle.db, workspaceId, (tx) => previewNumber(tx, "invoice", at));

// 23:59:59 on 31 Dec 2026 and 00:00 on 1 Jan 2027 in Kuala Lumpur (UTC+8).
const LAST_SECOND_OF_2026_KL = new Date("2026-12-31T15:59:59Z");
const FIRST_SECOND_OF_2027_KL = new Date("2026-12-31T16:00:00Z");

beforeAll(async () => {
  db = await startNumberingDb();
  handle = createDb(db.database.appUrl, { max: 4 });
  const [user] = await db.admin<{ id: string }[]>`insert into "user" (name, email) values ('Admin', 'allocate-admin@example.test') returning id`;
  if (!user) throw new Error("user not created");
  actor = user.id;
});

afterAll(async () => {
  await handle?.sql.end();
  await db?.stop();
});

describe("allocateNumber", () => {
  it("gives 0001, 0002 … and stores the counter with its period", async () => {
    const workspace = await db.newWorkspace();
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0001");
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0002");
    expect(await db.counterOf(workspace)).toEqual({ counter: 2, last_reset_period: "2026" });
  });

  it("yearly: starts again at 1 at midnight on 1 January in the workspace time zone, not UTC", async () => {
    const workspace = await db.newWorkspace();
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0001");
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0002");
    // Still 31 Dec in UTC: the number is 2027's first.
    expect(await allocate(workspace, FIRST_SECOND_OF_2027_KL)).toBe("INV-ACME-2027-0001");
    expect(await db.counterOf(workspace)).toEqual({ counter: 1, last_reset_period: "2027" });
  });

  it("yearly in UTC: the same instants are both in 2026", async () => {
    const workspace = await db.newWorkspace({ timeZone: "UTC" });
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0001");
    expect(await allocate(workspace, FIRST_SECOND_OF_2027_KL)).toBe("INV-ACME-2026-0002");
  });

  it("monthly: starts again at 1 on the first of each month in the workspace time zone", async () => {
    const workspace = await db.newWorkspace({ pattern: "{YYYY}{MM}-{SEQ:3}", resetRule: "monthly", timeZone: "Asia/Singapore" });
    expect(await allocate(workspace, new Date("2026-11-30T15:59:59Z"))).toBe("202611-001");
    expect(await allocate(workspace, new Date("2026-11-30T15:59:59Z"))).toBe("202611-002");
    expect(await allocate(workspace, new Date("2026-11-30T16:00:00Z"))).toBe("202612-001");
  });

  it("never: counts on across years", async () => {
    const workspace = await db.newWorkspace({ pattern: "{YY}-{SEQ:2}", resetRule: "never" });
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("26-01");
    expect(await allocate(workspace, FIRST_SECOND_OF_2027_KL)).toBe("27-02");
  });

  it("a rolled-back issue gives its number back: no gap", async () => {
    const workspace = await db.newWorkspace();
    await allocate(workspace, LAST_SECOND_OF_2026_KL);
    let taken = "";
    await expect(
      runInWorkspace(handle.db, workspace, async (tx) => {
        taken = (await allocateNumber(tx, "invoice", { clock: fixed(LAST_SECOND_OF_2026_KL) })).number;
        throw new Error("the issue failed after the number was taken");
      }),
    ).rejects.toThrow("the issue failed");
    expect(taken).toBe("INV-ACME-2026-0002");
    expect(await db.counterOf(workspace)).toEqual({ counter: 1, last_reset_period: "2026" });
    expect(await allocate(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0002");
  });

  it("refuses {CODE} when the workspace has no short code, and takes no number", async () => {
    const workspace = await db.newWorkspace({ shortCode: null });
    await expect(allocate(workspace, LAST_SECOND_OF_2026_KL)).rejects.toBeInstanceOf(MissingCodeError);
    expect(await db.counterOf(workspace)).toEqual({ counter: 0, last_reset_period: null });
  });

  it("two workspaces count apart, and neither sees or moves the other's counter (TEN-08)", async () => {
    const a = await db.newWorkspace({ shortCode: "AAA" });
    const b = await db.newWorkspace({ shortCode: "BBB" });
    expect(await allocate(a, LAST_SECOND_OF_2026_KL)).toBe("INV-AAA-2026-0001");
    expect(await allocate(a, LAST_SECOND_OF_2026_KL)).toBe("INV-AAA-2026-0002");
    expect(await allocate(b, LAST_SECOND_OF_2026_KL)).toBe("INV-BBB-2026-0001");
    expect(await db.counterOf(a)).toEqual({ counter: 2, last_reset_period: "2026" });
    expect(await db.counterOf(b)).toEqual({ counter: 1, last_reset_period: "2026" });
  });
});

// Holds the row lock of `workspace`'s invoice counter in an open transaction until release() is called: the
// transaction takes a number with `clock` (by default 23:59:59 on 31 Dec 2026 in KL) and keeps the lock.
async function holdLock(workspace: string, clock: Clock = fixed(LAST_SECOND_OF_2026_KL)) {
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  let locked = () => {};
  const isLocked = new Promise<void>((resolve) => (locked = resolve));
  const done = runInWorkspace(handle.db, workspace, async (tx) => {
    const taken = await allocateNumber(tx, "invoice", { clock });
    locked();
    await released;
    return taken;
  });
  await isLocked;
  return { release, done };
}

const settledWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

describe("the lock scope", () => {
  it("an issue waits for another issue of the same workspace; another workspace and a preview do not wait", async () => {
    const workspace = await db.newWorkspace();
    const other = await db.newWorkspace({ shortCode: "OTHER" });
    const held = await holdLock(workspace);

    // A preview takes no lock: it answers at once, with the number the held transaction has not committed yet.
    expect(await preview(workspace, LAST_SECOND_OF_2026_KL)).toBe("INV-ACME-2026-0001");
    // Another workspace's counter is another row.
    expect(await allocate(other, LAST_SECOND_OF_2026_KL)).toBe("INV-OTHER-2026-0001");

    const waiting = allocate(workspace, LAST_SECOND_OF_2026_KL);
    expect(await settledWithin(waiting, 300)).toBe(false);
    held.release();
    expect((await held.done).number).toBe("INV-ACME-2026-0001");
    expect(await waiting).toBe("INV-ACME-2026-0002");
  });
});

// Bob PR #72 R1 P1: a time in a period earlier than the last number's never starts the counter again (that would
// repeat a number already given). The allocator reads the time after the lock, from the database clock, and refuses
// an earlier period with PeriodBehindError.
describe("the time is read after the lock, and a period is never reset backwards", () => {
  const dbNow = async () => {
    const [row] = await db.admin<{ ms: number }[]>`select (extract(epoch from clock_timestamp()) * 1000)::float8 as ms`;
    return new Date(Number(row?.ms));
  };

  it("by default the time is the database clock's, read after the lock was granted, and returned with the number", async () => {
    const workspace = await db.newWorkspace();
    const held = await holdLock(workspace, databaseClock);
    const waiting = runInWorkspace(handle.db, workspace, (tx) => allocateNumber(tx, "invoice"));
    expect(await settledWithin(waiting, 300)).toBe(false);
    const releasedAt = await dbNow();
    held.release();
    const first = await held.done;
    const second = await waiting;
    // The waiting issue began before releasedAt, so a time read before its lock would be earlier.
    expect(second.issuedAt.getTime()).toBeGreaterThanOrEqual(releasedAt.getTime());
    expect(second.issuedAt.getTime()).toBeGreaterThan(first.issuedAt.getTime());
    const year = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuala_Lumpur", year: "numeric" }).format(second.issuedAt);
    expect(second.number).toMatch(new RegExp(`^INV-ACME-${year}-000[12]$`));
  });

  it("year-end race: an issue that waited on the lock across midnight takes the new year's next number", async () => {
    const workspace = await db.newWorkspace();
    expect(await allocate(workspace, new Date("2026-03-02T02:00:00Z"))).toBe("INV-ACME-2026-0001");
    // One timeline for both transactions: A arrives at 23:59:59 on 31 Dec (KL) and waits on the lock B holds; B
    // takes its number at 00:00:01 on 1 Jan 2027 and commits after that.
    let now = LAST_SECOND_OF_2026_KL;
    const timeline: Clock = async () => now;
    now = new Date("2026-12-31T16:00:01Z");
    const b = await holdLock(workspace, timeline);
    now = LAST_SECOND_OF_2026_KL;
    const a = runInWorkspace(handle.db, workspace, (tx) => allocateNumber(tx, "invoice", { clock: timeline }));
    expect(await settledWithin(a, 300)).toBe(false);
    now = new Date("2026-12-31T16:00:02Z");
    b.release();
    expect((await b.done).number).toBe("INV-ACME-2027-0001");
    // A's time is the one read after the lock: 00:00:02, so 2027's second number, not 2026's first again.
    expect(await a).toEqual({ number: "INV-ACME-2027-0002", issuedAt: new Date("2026-12-31T16:00:02Z") });
    expect(await db.counterOf(workspace)).toEqual({ counter: 2, last_reset_period: "2027" });
  });

  it("year-end race: an issue whose time was fixed before the lock is refused, never given 2026's first number again", async () => {
    const workspace = await db.newWorkspace();
    expect(await allocate(workspace, new Date("2026-03-02T02:00:00Z"))).toBe("INV-ACME-2026-0001");
    const b = await holdLock(workspace, fixed(new Date("2026-12-31T16:00:01Z")));
    // A's clock is stuck at the instant before it waited (a caller's own "now", taken early).
    const a = allocate(workspace, LAST_SECOND_OF_2026_KL);
    const outcome = a.then(
      (number) => ({ number }),
      (error: unknown) => ({ error }),
    );
    expect(await settledWithin(a, 300)).toBe(false);
    b.release();
    expect((await b.done).number).toBe("INV-ACME-2027-0001");
    const result = await outcome;
    expect(result).toEqual({ error: expect.any(PeriodBehindError) });
    expect(await db.counterOf(workspace)).toEqual({ counter: 1, last_reset_period: "2027" });
  });

  it("a time zone change to one still in the old year: refused until the new year starts there, then the next number", async () => {
    const workspace = await db.newWorkspace();
    // 00:30 on 1 Jan 2027 in KL.
    expect(await allocate(workspace, new Date("2026-12-31T16:30:00Z"))).toBe("INV-ACME-2027-0001");
    await db.admin`update workspace_settings set timezone = 'America/New_York' where workspace_id = ${workspace}`;
    // 11:31 on 31 Dec 2026 in New York.
    const behind = new Date("2026-12-31T16:31:00Z");
    await expect(allocate(workspace, behind)).rejects.toBeInstanceOf(PeriodBehindError);
    await expect(preview(workspace, behind)).rejects.toBeInstanceOf(PeriodBehindError);
    expect(await db.counterOf(workspace)).toEqual({ counter: 1, last_reset_period: "2027" });
    // 00:00:01 on 1 Jan 2027 in New York.
    expect(await allocate(workspace, new Date("2027-01-01T05:00:01Z"))).toBe("INV-ACME-2027-0002");
  });

  it("a reset-rule change while the time zone is behind the stored period is refused and writes nothing", async () => {
    const workspace = await db.newWorkspace({ pattern: "INV-{YYYY}-{MM}-{SEQ:4}" });
    expect(await allocate(workspace, new Date("2026-12-31T16:30:00Z"))).toBe("INV-2027-01-0001");
    await db.admin`update workspace_settings set timezone = 'America/New_York' where workspace_id = ${workspace}`;
    const change = (at: Date) =>
      runInWorkspace(handle.db, workspace, (tx) =>
        updateSequence(tx, "invoice", { pattern: "INV-{YYYY}-{MM}-{SEQ:4}", resetRule: "monthly" }, 1, actor, "America/New_York", {
          clock: fixed(at),
        }),
      );
    // Reset at once would make the next number in New York's January 2027 "INV-2027-01-0001" again.
    await expect(change(new Date("2026-12-31T16:32:00Z"))).rejects.toBeInstanceOf(PeriodBehindError);
    const [row] = await db.admin`select reset_rule, counter, last_reset_period, version from doc_sequence where workspace_id = ${workspace}`;
    expect(row).toEqual({ reset_rule: "yearly", counter: 1, last_reset_period: "2027", version: 1 });
    // Once 2027 has started in New York the change goes through, and the counter continues.
    expect((await change(new Date("2027-01-01T05:00:01Z"))).lastResetPeriod).toBe("2027-01");
    expect(await allocate(workspace, new Date("2027-01-01T05:00:02Z"))).toBe("INV-2027-01-0002");
  });

  it("year-end race: a reset-rule change that waited on an issue across midnight keeps the new year's counter", async () => {
    const workspace = await db.newWorkspace({ pattern: "INV-{YYYY}-{MM}-{SEQ:4}" });
    expect(await allocate(workspace, new Date("2026-03-02T02:00:00Z"))).toBe("INV-2026-03-0001");
    let now = new Date("2026-12-31T16:00:01Z");
    const timeline: Clock = async () => now;
    const issue = await holdLock(workspace, timeline);
    // The save arrives at 23:59:59 on 31 Dec (KL) and waits on the lock the issue holds.
    now = LAST_SECOND_OF_2026_KL;
    const save = runInWorkspace(handle.db, workspace, (tx) =>
      updateSequence(tx, "invoice", { pattern: "INV-{YYYY}-{MM}-{SEQ:4}", resetRule: "monthly" }, 1, actor, "Asia/Kuala_Lumpur", {
        clock: timeline,
      }),
    );
    expect(await settledWithin(save, 300)).toBe(false);
    now = new Date("2026-12-31T16:00:02Z");
    issue.release();
    expect((await issue.done).number).toBe("INV-2027-01-0001");
    // Its time is read after the lock (2027), so January keeps the counter: the next number is 0002, not 0001 again.
    expect(await save).toMatchObject({ resetRule: "monthly", counter: 1, lastResetPeriod: "2027-01" });
    expect(await allocate(workspace, new Date("2026-12-31T16:00:03Z"))).toBe("INV-2027-01-0002");
  });

  it("a backdated time (a caller's issue date before the last number's period) is refused", async () => {
    const workspace = await db.newWorkspace();
    expect(await allocate(workspace, new Date("2026-06-01T02:00:00Z"))).toBe("INV-ACME-2026-0001");
    expect(await allocate(workspace, new Date("2027-01-05T02:00:00Z"))).toBe("INV-ACME-2027-0001");
    await expect(allocate(workspace, new Date("2026-12-15T02:00:00Z"))).rejects.toBeInstanceOf(PeriodBehindError);
    expect(await db.counterOf(workspace)).toEqual({ counter: 1, last_reset_period: "2027" });
    // A time inside the stored period is fine, even if earlier than the last number's.
    expect(await allocate(workspace, new Date("2027-01-02T02:00:00Z"))).toBe("INV-ACME-2027-0002");
  });

  it("two instances with skewed clocks: the one behind is refused, never 2026's first number again", async () => {
    const workspace = await db.newWorkspace();
    expect(await allocate(workspace, new Date("2026-03-02T02:00:00Z"))).toBe("INV-ACME-2026-0001");
    const trueTime = new Date("2026-12-31T15:59:58Z");
    // Instance 1 runs 3 s fast: already 2027 in KL.
    expect(await allocate(workspace, new Date(trueTime.getTime() + 3000))).toBe("INV-ACME-2027-0001");
    // Instance 2 is accurate, a second later: still 2026 in KL.
    await expect(allocate(workspace, new Date(trueTime.getTime() + 1000))).rejects.toBeInstanceOf(PeriodBehindError);
    expect(await db.counterOf(workspace)).toEqual({ counter: 1, last_reset_period: "2027" });
  });
});
