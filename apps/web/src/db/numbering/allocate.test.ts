import { MissingCodeError } from "@crm/core/numbering";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";
import { allocateNumber, previewNumber } from "./allocate";
import { startNumberingDb, type NumberingTestDb } from "../../test/numbering-db";

// Phase 2 plan Task 18: the allocator as crm_app under RLS. Period resets at the workspace time zone's boundaries
// (REC-08), no gap after a rollback (REC-07), two-workspace isolation, and the lock scope.
let db: NumberingTestDb;
let handle: DbHandle;

const allocate = (workspaceId: string, at: Date) => runInWorkspace(handle.db, workspaceId, (tx) => allocateNumber(tx, "invoice", at));
const preview = (workspaceId: string, at: Date) => runInWorkspace(handle.db, workspaceId, (tx) => previewNumber(tx, "invoice", at));

// 23:59:59 on 31 Dec 2026 and 00:00 on 1 Jan 2027 in Kuala Lumpur (UTC+8).
const LAST_SECOND_OF_2026_KL = new Date("2026-12-31T15:59:59Z");
const FIRST_SECOND_OF_2027_KL = new Date("2026-12-31T16:00:00Z");

beforeAll(async () => {
  db = await startNumberingDb();
  handle = createDb(db.database.appUrl, { max: 4 });
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
        taken = await allocateNumber(tx, "invoice", LAST_SECOND_OF_2026_KL);
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

describe("the lock scope", () => {
  // Holds the row lock of `workspace`'s invoice counter in an open transaction until release() is called.
  async function holdLock(workspace: string) {
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked = () => {};
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    const done = runInWorkspace(handle.db, workspace, async (tx) => {
      const number = await allocateNumber(tx, "invoice", LAST_SECOND_OF_2026_KL);
      locked();
      await released;
      return number;
    });
    await isLocked;
    return { release, done };
  }

  const settledWithin = (promise: Promise<unknown>, ms: number) =>
    Promise.race([promise.then(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

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
    expect(await held.done).toBe("INV-ACME-2026-0001");
    expect(await waiting).toBe("INV-ACME-2026-0002");
  });
});
