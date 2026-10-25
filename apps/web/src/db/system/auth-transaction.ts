import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import type { Database } from "../client";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// A request waits at most this long for another request of the same user (lockAuthUsers) or for any other lock,
// then fails with no change instead of hanging.
const LOCK_TIMEOUT = "5s";

// Only a normalized IP address reaches the SET statement (Better Auth's getIP returns one, or null).
const IP_ADDRESS = /^[0-9A-Fa-f:.]{2,45}$/;

class Rollback<T> {
  constructor(readonly result: T) {}
}

export interface AuthTransactions {
  // The database Better Auth's adapter uses: inside run(), every query goes to that request's transaction.
  db: Database;
  run<T>(
    clientIp: string | null,
    work: () => Promise<T>,
    keep: (result: T) => boolean,
  ): Promise<{ result: T; committed: boolean }>;
}

// Better Auth 1.7.6 makes each write of a sign-in or 2FA flow its own autocommit statement and opens no
// transaction (plan Task 31, fact iii). run() makes one request one transaction: it commits when keep(result)
// holds and rolls back otherwise, or when the work throws. auth_audit_log's triggers read crm.auth_client_ip.
export function createAuthTransactions(db: Database): AuthTransactions {
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
    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`));
        if (clientIp !== null && IP_ADDRESS.test(clientIp)) {
          await tx.execute(sql.raw(`SET LOCAL crm.auth_client_ip = '${clientIp}'`));
        }
        const value = await current.run(tx, work);
        if (!keep(value)) throw new Rollback(value);
        // Better Auth swallows some query errors; a statement fails here if one left the transaction aborted.
        await tx.execute(sql`select 1`);
        return value;
      });
      return { result, committed: true };
    } catch (error) {
      if (error instanceof Rollback) return { result: error.result as T, committed: false };
      throw error;
    }
  }

  return { db: routed, run };
}
