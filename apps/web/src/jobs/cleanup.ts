import { sql } from "drizzle-orm";
import { cleanupExpiredCounters, listWorkspaceIds } from "../db/system";
import { withWorkspace } from "../db/workspace";
import type { Handler } from "./handlers";
import { logInfo } from "./log";

// The two daily cleanups (plan Task 24 Step 3; EVT-06): worker-owned pg-boss schedules, no HTTP route. Cron in UTC
// (pg-boss's default time zone), at fixed minutes away from the hour; operational constants, DECISIONS "Phase 1 PR 7".
export const RATE_LIMIT_CLEANUP_CRON = "17 3 * * *";
export const IDEMPOTENCY_CLEANUP_CRON = "47 3 * * *";

// `rate_limit` is a system table (no RLS, no workspace): the system module deletes the ended windows.
export function rateLimitCleanupHandler(): Handler {
  return async (_jobs, { log }) => {
    const deleted = await cleanupExpiredCounters();
    logInfo(log, "rate_limit.cleanup done", { deleted });
  };
}

// One workspace's expired idempotency keys, in that workspace's transaction (RLS: no other workspace's row is seen).
export async function deleteExpiredIdempotencyKeys(workspaceId: string): Promise<number> {
  return withWorkspace(workspaceId, async (tx) => {
    const deleted = await tx.execute(sql`delete from idempotency_key where expires_at < clock_timestamp()`);
    return deleted.count;
  });
}

export function idempotencyCleanupHandler(): Handler {
  return async (_jobs, { log }) => {
    let deleted = 0;
    for (const workspaceId of await listWorkspaceIds()) deleted += await deleteExpiredIdempotencyKeys(workspaceId);
    logInfo(log, "idempotency.cleanup done", { deleted });
  };
}
