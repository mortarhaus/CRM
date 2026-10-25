import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Set while an auth request transaction holds a connection of `pool` (createAuthTransactions; PR #44 P2-1). Inside
// it every query must go to that transaction. A query on the pool itself needs a second connection and may wait,
// with no lock_timeout, for a row lock its own transaction holds; it fails at once instead.
interface PoolHold {
  readonly pool: object;
  bypassed: boolean;
}
const poolHold = new AsyncLocalStorage<PoolHold>();

export class PoolBypassError extends Error {
  override readonly name = "PoolBypassError";

  constructor(options?: ErrorOptions) {
    super("a query bypassed the request transaction", options);
  }
}

function refuseWhileHeld(pool: object): void {
  const hold = poolHold.getStore();
  if (hold?.pool !== pool) return;
  hold.bypassed = true;
  throw new PoolBypassError();
}

// Runs `work` while a transaction of `pool` is open for it, and fails with PoolBypassError when a query missed the
// transaction, even one whose error the work swallowed or that Drizzle wrapped in its own error. The result is
// awaited inside the hold: a Drizzle query is lazy and runs only when it is awaited.
export async function holdingPool<T>(pool: object, work: () => Promise<T>): Promise<T> {
  const hold: PoolHold = { pool, bypassed: false };
  let value: T;
  try {
    value = await poolHold.run(hold, async () => await work());
  } catch (error) {
    if (hold.bypassed) throw new PoolBypassError({ cause: error });
    throw error;
  }
  if (hold.bypassed) throw new PoolBypassError();
  return value;
}

// Every query of the pool itself (a tagged call, or `unsafe`, which Drizzle uses) passes the check; a transaction's
// statements run on the connection `begin` reserves and do not.
function guarded<T extends postgres.Sql>(pool: T): T {
  const proxy: T = new Proxy(pool, {
    apply(target, thisArg, args) {
      refuseWhileHeld(proxy);
      return Reflect.apply(target, thisArg, args) as unknown;
    },
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (property !== "unsafe" || typeof value !== "function") return value;
      return (...args: unknown[]) => {
        refuseWhileHeld(proxy);
        return Reflect.apply(value, target, args) as unknown;
      };
    },
  });
  return proxy;
}

export function createDb(url: string, options: { max?: number } = {}) {
  // Phase 1+ connects through a transaction-mode pooler, where server-side prepared statements break (spec v4.5, Spike 1).
  const sql = guarded(postgres(url, { max: options.max ?? 10, prepare: false }));
  const db = drizzle({ client: sql, schema });
  return { sql, db };
}

export type DbHandle = ReturnType<typeof createDb>;
export type Database = DbHandle["db"];
