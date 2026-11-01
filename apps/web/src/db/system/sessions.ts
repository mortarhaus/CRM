import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../client";
import { getDb } from "../index";
import { session } from "../schema";

// Ends one of the caller's own sessions by id (PR #44 Round 1 P2-3; plan Task 24): /list-sessions returns no token
// (Task 31 R10), so Better Auth's /revoke-session, which takes one, cannot end a chosen session. The user id comes
// from the caller's own session, never from the request; a session id of another user matches no row.
export async function revokeOwnSession(userId: string, sessionId: string, db: Database = getDb().db): Promise<boolean> {
  if (!z.uuid().safeParse(sessionId).success) return false;
  const deleted = await db
    .delete(session)
    .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
    .returning({ id: session.id });
  return deleted.length === 1;
}
