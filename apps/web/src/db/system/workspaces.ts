import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../client";
import { member, workspaceSettings } from "../schema";
import { runInWorkspace } from "../workspace";

export const WORKSPACE_ROLES = ["owner", "admin", "staff"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const ids = z.object({ userId: z.uuid(), workspaceId: z.uuid() });
const role = z.enum(WORKSPACE_ROLES);

// The user's role in a workspace, read from member by (user_id, organization_id) and never from the
// session's active workspace (TEN-11). Anything not exactly one row with a known role is no membership:
// an id that is not a uuid, no row, two rows, or a stored role outside owner, admin and staff.
export async function getMembership(
  db: Database,
  userId: string,
  workspaceId: string,
): Promise<{ role: WorkspaceRole } | null> {
  const parsed = ids.safeParse({ userId, workspaceId });
  if (!parsed.success) return null;
  const rows = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, parsed.data.userId), eq(member.organizationId, parsed.data.workspaceId)))
    .limit(2);
  if (rows.length !== 1) return null;
  const known = role.safeParse(rows[0]?.role);
  return known.success ? { role: known.data } : null;
}

// Better Auth writes the organization row in its own statement first, so this runs as a second write.
// It is idempotent: a workspace whose row is missing (a crash between the two writes) can be healed on
// first use (plan Risk 6).
export function ensureWorkspaceSettings(db: Database, workspaceId: string): Promise<void> {
  return runInWorkspace(db, workspaceId, async (tx) => {
    await tx.insert(workspaceSettings).values({ workspaceId }).onConflictDoNothing();
  });
}
