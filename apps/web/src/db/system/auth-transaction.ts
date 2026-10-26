import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { type Database, holdingPool } from "../client";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// A request waits at most this long for another request of the same user or the same sign-in email
// (lockAuthUsers) or for any other lock, then fails with no change instead of hanging.
const LOCK_TIMEOUT = "5s";

// Auth request transactions hold at most half of the pool's connections (at least one), so a burst of sign-ins
// that wait for one user's lock never takes every connection of the app (PR #44 P2-1). A request waits at most
// SLOT_WAIT_MS for a free slot, then fails with no change (500).
const POOL_SHARE = 0.5;
export const SLOT_WAIT_MS = 10_000;

// Only a normalized IP address reaches the SET statement (Better Auth's getIP returns one, or null).
const IP_ADDRESS = /^[0-9A-Fa-f:.]{2,45}$/;

class Rollback<T> {
  constructor(readonly result: T) {}
}

export class AuthTransactionsBusy extends Error {
  override readonly name = "AuthTransactionsBusy";

  constructor() {
    super("no auth transaction slot became free in time");
  }
}

export interface AuthTransactions {
  // The database Better Auth's adapter uses: inside run(), every query goes to that request's transaction.
  db: Database;
  // How many request transactions may be open at once.
  slots: number;
  run<T>(
    clientIp: string | null,
    work: () => Promise<T>,
    keep: (result: T) => boolean,
  ): Promise<{ result: T; committed: boolean }>;
}

// A counting semaphore with a first-come queue: take() resolves with the function that frees the slot.
function slotQueue(size: number, waitMs: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return function take(): Promise<() => void> {
    let freed = false;
    const free = () => {
      if (freed) return;
      freed = true;
      const nextInLine = waiting.shift();
      if (nextInLine) nextInLine();
      else active -= 1;
    };
    if (active < size) {
      active += 1;
      return Promise.resolve(free);
    }
    return new Promise((resolve, reject) => {
      const granted = () => {
        clearTimeout(timer);
        resolve(free);
      };
      const timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(granted), 1);
        reject(new AuthTransactionsBusy());
      }, waitMs);
      waiting.push(granted);
    });
  };
}

// Better Auth 1.7.6 makes each write of a sign-in or 2FA flow its own autocommit statement and opens no
// transaction (plan Task 31, fact iii). run() makes one request one transaction: it commits when keep(result)
// holds and rolls back otherwise, or when the work throws. auth_audit_log's triggers read crm.auth_client_ip.
// Inside run() a query on `db`'s pool that misses the transaction fails at once (PoolBypassError), and the request
// rolls back even if the work swallowed that error.
export function createAuthTransactions(
  db: Database,
  options: { slots?: number; slotWaitMs?: number } = {},
): AuthTransactions {
  const pool = db.$client;
  const slots = options.slots ?? Math.max(1, Math.floor(pool.options.max * POOL_SHARE));
  const takeSlot = slotQueue(slots, options.slotWaitMs ?? SLOT_WAIT_MS);
  const current = new AsyncLocalStorage<Transaction>();
  const routed = new Proxy(db, {
    get(target, property) {
      const source = current.getStore() ?? target;
      const value: unknown = Reflect.get(source, property, source);
      return typeof value === "function" ? value.bind(source) : value;
    },
  });

  async function run<T>(clientIp: string | null, work: () => Promise<T>, keep: (result: T) => boolean) {
    if (current.getStore()) return { result: await work(), committed: true };
    const free = await takeSlot();
    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`));
        if (clientIp !== null && IP_ADDRESS.test(clientIp)) {
          await tx.execute(sql.raw(`SET LOCAL crm.auth_client_ip = '${clientIp}'`));
        }
        const value = await holdingPool(pool, () => current.run(tx, work));
        if (!keep(value)) throw new Rollback(value);
        // Better Auth swallows some query errors; a statement fails here if one left the transaction aborted.
        await tx.execute(sql`select 1`);
        return value;
      });
      return { result, committed: true };
    } catch (error) {
      if (error instanceof Rollback) return { result: error.result as T, committed: false };
      throw error;
    } finally {
      free();
    }
  }

  return { db: routed, slots, run };
}
