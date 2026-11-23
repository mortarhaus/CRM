import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";
import { allocateNumber } from "./allocate";
import { startNumberingDb, type NumberingTestDb } from "../../test/numbering-db";

// REC-10 (spec line 1191; Phase 2 plan Task 18): 50 issues at once, each in its own transaction on its own
// connection, give 50 unique and contiguous numbers.
const PARALLEL = 50;

let db: NumberingTestDb;
let handle: DbHandle;

beforeAll(async () => {
  db = await startNumberingDb();
  handle = createDb(db.database.appUrl, { max: PARALLEL });
});

afterAll(async () => {
  await handle?.sql.end();
  await db?.stop();
});

it(`${PARALLEL} parallel transactions on separate connections get ${PARALLEL} unique, contiguous numbers`, async () => {
  const workspace = await db.newWorkspace();
  const at = new Date("2026-06-15T04:00:00Z");
  // Every transaction first waits until all of them hold a connection of their own, then allocates.
  let arrived = 0;
  let allArrived = () => {};
  const gate = new Promise<void>((resolve) => (allArrived = resolve));
  const backends = new Set<number>();
  const numbers = await Promise.all(
    Array.from({ length: PARALLEL }, () =>
      runInWorkspace(handle.db, workspace, async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        if (row) backends.add(row.pid);
        arrived += 1;
        if (arrived === PARALLEL) allArrived();
        await gate;
        return allocateNumber(tx, "invoice", at);
      }),
    ),
  );

  expect(backends.size).toBe(PARALLEL);
  expect(new Set(numbers).size).toBe(PARALLEL);
  expect([...numbers].sort()).toEqual(Array.from({ length: PARALLEL }, (_, i) => `INV-ACME-2026-${String(i + 1).padStart(4, "0")}`));
  expect(await db.counterOf(workspace)).toEqual({ counter: PARALLEL, last_reset_period: "2026" });
});
