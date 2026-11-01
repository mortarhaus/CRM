import { RATE_LIMIT_ROW_RETENTION_SECONDS } from "@crm/core/security";
import { sql } from "drizzle-orm";
import type { Database } from "../client";
import { getDb } from "../index";

// The database rate-limit counters (spec "Authentication and sessions" → "Rate limits"; AUTH-06; plan Task 21).
// `rate_limit` is a system table without RLS: only this module reads or writes it (TEN-10). Keys are prefixed
// `ba:` (Better Auth's limiter) or `acct:` (the per-account sign-in counter, an HMAC); never a raw email or token.
//
// `now` is injectable for tests; production passes null and the database clock decides (clock_timestamp()).

export type ConsumeResult =
  | { readonly allowed: true; readonly windowStart: string }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

// One statement decides: the row lock taken by ON CONFLICT serializes concurrent callers on the same key, and a
// row only comes back when the call was granted. `window_start` comes back as text so `giveBack` can match it
// exactly (clock_timestamp() has microseconds; a JavaScript Date keeps milliseconds).
export async function consume(
  db: Database,
  key: string,
  max: number,
  windowSeconds: number,
  now: Date | null,
): Promise<ConsumeResult> {
  const at = sql`coalesce(${now?.toISOString() ?? null}::timestamptz, clock_timestamp())`;
  const ended = sql`r.window_start + make_interval(secs => r.window_seconds) <= ${at}`;
  const granted = await db.execute<{ window_start: string }>(sql`
    insert into rate_limit as r (key, count, window_start, window_seconds)
    values (${key}, 1, ${at}, ${windowSeconds})
    on conflict (key) do update set
      count = case when ${ended} then 1 else r.count + 1 end,
      window_start = case when ${ended} then ${at} else r.window_start end,
      window_seconds = excluded.window_seconds
    where ${ended} or r.count < ${max}
    returning r.count, r.window_start::text as window_start`);
  const [row] = granted;
  if (row) return { allowed: true, windowStart: row.window_start };
  // Read only for the Retry-After header; the decision above was atomic.
  const [left] = await db.execute<{ seconds: number }>(sql`
    select greatest(1, ceil(extract(epoch from
      window_start + make_interval(secs => window_seconds) - ${at})))::integer as seconds
    from rate_limit where key = ${key}`);
  return { allowed: false, retryAfterSeconds: left?.seconds ?? windowSeconds };
}

// Returns one unit to the window it was taken from (a successful sign-in does not count toward the account cap).
// After the window rolled, or at zero, it changes nothing.
export async function giveBack(db: Database, key: string, windowStart: string): Promise<void> {
  await db.execute(sql`
    update rate_limit set count = count - 1
    where key = ${key} and window_start = ${windowStart}::timestamptz and count > 0`);
}

// The daily cleanup (worker job `rate_limit.cleanup`): deletes rows whose window ended more than 24 hours ago.
export async function cleanupExpired(db: Database, now: Date | null): Promise<number> {
  const at = sql`coalesce(${now?.toISOString() ?? null}::timestamptz, clock_timestamp())`;
  const deleted = await db.execute(sql`
    delete from rate_limit
    where window_start + make_interval(secs => window_seconds + ${RATE_LIMIT_ROW_RETENTION_SECONDS}) < ${at}`);
  return deleted.count;
}

// The worker's job (jobs/cleanup.ts): the same delete on the process's crm_app pool, at the database clock.
export function cleanupExpiredCounters(): Promise<number> {
  return cleanupExpired(getDb().db, null);
}
