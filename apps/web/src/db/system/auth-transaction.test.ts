import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle, PoolBypassError } from "../client";
import { AuthTransactionsBusy, createAuthTransactions } from "./auth-transaction";

// PR #44 P2-1: auth request transactions take at most half of the pool, and inside one a query that misses the
// routed db fails at once instead of waiting for a second connection or for its own transaction's locks.

let database: TestDatabase;
let handle: DbHandle;
let admin: postgres.Sql;

beforeAll(async () => {
  database = await startDatabase();
  handle = createDb(database.appUrl, { max: 4 });
  admin = postgres(database.adminUrl, { max: 1 });
});

afterAll(async () => {
  await handle?.sql.end({ timeout: 1 });
  await admin?.end();
  await database?.stop();
});

const keep = () => true;

function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

// Resolves with how long `promise` took to settle, in ms (or rejects with its error).
async function timed<T>(promise: Promise<T>): Promise<number> {
  const started = performance.now();
  await promise;
  return performance.now() - started;
}

describe("a query that misses the request transaction", () => {
  it("fails at once on the pool's Drizzle instance and on its tagged calls", async () => {
    const transactions = createAuthTransactions(handle.db);
    const started = performance.now();
    await expect(transactions.run(null, () => handle.db.execute(sql`select 1`), keep)).rejects.toBeInstanceOf(
      PoolBypassError,
    );
    await expect(transactions.run(null, async () => handle.sql`select 1`, keep)).rejects.toBeInstanceOf(PoolBypassError);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("rolls the request back even when the work swallowed the error", async () => {
    const transactions = createAuthTransactions(handle.db);
    const email = `bypass-${Date.now()}@example.test`;
    const outcome = transactions.run(
      null,
      async () => {
        await transactions.db.execute(sql`insert into "user" (name, email) values ('Bypass', ${email})`);
        await handle.db.execute(sql`select 1`).catch(() => undefined);
        return "done";
      },
      keep,
    );
    await expect(outcome).rejects.toBeInstanceOf(PoolBypassError);
    expect(await admin`select 1 from "user" where email = ${email}`).toHaveLength(0);
  });

  it("is not raised for the routed db inside run(), for another pool, or for the pool outside run()", async () => {
    const transactions = createAuthTransactions(handle.db);
    const other = createDb(database.appUrl, { max: 1 });
    try {
      const { result, committed } = await transactions.run(
        null,
        async () => {
          const routed = await transactions.db.execute<{ ok: number }>(sql`select 1 as ok`);
          const elsewhere = await other.sql<{ ok: number }[]>`select 1 as ok`;
          return [routed[0]?.ok, elsewhere[0]?.ok];
        },
        keep,
      );
      expect({ result, committed }).toEqual({ result: [1, 1], committed: true });
      expect(await handle.sql`select 1 as ok`).toEqual([{ ok: 1 }]);
    } finally {
      await other.sql.end({ timeout: 1 });
    }
  });
});

describe("request transactions hold at most half of the pool", () => {
  it("opens at most `slots` at once, and the pool serves other queries meanwhile", async () => {
    const transactions = createAuthTransactions(handle.db);
    expect(transactions.slots).toBe(2);
    const release = gate();
    let open = 0;
    let mostOpen = 0;
    const runs = Array.from({ length: 5 }, () =>
      transactions.run(
        null,
        async () => {
          await transactions.db.execute(sql`select 1`);
          open += 1;
          mostOpen = Math.max(mostOpen, open);
          await release.opened;
          open -= 1;
          return "done";
        },
        keep,
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mostOpen).toBe(2);
    // Two connections are held by open transactions; the other two serve the rest of the app.
    expect(await timed(Promise.all([handle.sql`select 1`, handle.sql`select 2`]))).toBeLessThan(1_000);
    release.open();
    expect(await Promise.all(runs)).toEqual(Array.from({ length: 5 }, () => ({ result: "done", committed: true })));
    expect(mostOpen).toBe(2);
  });

  it("fails a request that waits longer than the slot wait, without running it, and frees its place in line", async () => {
    const transactions = createAuthTransactions(handle.db, { slots: 1, slotWaitMs: 200 });
    const release = gate();
    const holder = transactions.run(null, () => release.opened.then(() => "held"), keep);
    let ran = false;
    await expect(
      transactions.run(
        null,
        async () => {
          ran = true;
          return "late";
        },
        keep,
      ),
    ).rejects.toBeInstanceOf(AuthTransactionsBusy);
    expect(ran).toBe(false);
    release.open();
    expect(await holder).toEqual({ result: "held", committed: true });
    expect(await transactions.run(null, async () => "next", keep)).toEqual({ result: "next", committed: true });
  });

  it("does not take a second slot for a nested run", async () => {
    const transactions = createAuthTransactions(handle.db, { slots: 1, slotWaitMs: 200 });
    const outer = await transactions.run(
      null,
      async () => (await transactions.run(null, async () => "inner", keep)).result,
      keep,
    );
    expect(outer).toEqual({ result: "inner", committed: true });
  });

  it("frees the slot when the work throws or the transaction rolls back", async () => {
    const transactions = createAuthTransactions(handle.db, { slots: 1, slotWaitMs: 200 });
    await expect(
      transactions.run(
        null,
        async () => {
          throw new Error("work failed");
        },
        keep,
      ),
    ).rejects.toThrow("work failed");
    expect(await transactions.run(null, async () => "kept?", () => false)).toEqual({
      result: "kept?",
      committed: false,
    });
    expect(await transactions.run(null, async () => "after", keep)).toEqual({ result: "after", committed: true });
  });
});
