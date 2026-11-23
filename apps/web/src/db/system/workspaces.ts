import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../client";
import { getDb } from "../index";
import { member, organization, workspaceSettings } from "../schema";
import { runInWorkspace, type Tx } from "../workspace";

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

// getMembership() on the app's own pool, for requireWorkspaceMember() (plan Task 14): app code never holds the
// database handle (TEN-10), so the system module binds it here.
export function findMembership(userId: string, workspaceId: string): Promise<{ role: WorkspaceRole } | null> {
  return getMembership(getDb().db, userId, workspaceId);
}

// Heals a missing workspace_settings row on first use (plan Task 14 Step 3, Risk 6): one read when it is there,
// ensureWorkspaceSettings() when it is not.
export async function healWorkspaceSettings(workspaceId: string): Promise<void> {
  const { db } = getDb();
  const present = await runInWorkspace(db, workspaceId, (tx) =>
    tx.select({ workspaceId: workspaceSettings.workspaceId }).from(workspaceSettings).limit(1),
  );
  if (present.length === 0) await ensureWorkspaceSettings(db, workspaceId);
}

// The Owners of a workspace (spec "Authorization": a bank-details change notifies all owners), read from member by
// organization_id, in the caller's transaction so the list matches the change it is written with.
export async function listOwnerIds(db: Database | Tx, workspaceId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(and(eq(member.organizationId, workspaceId), eq(member.role, "owner")))
    .orderBy(member.userId);
  return rows.map((row) => row.userId);
}

// The workspace's name (organization.name), for the owner email on a bank-details change (plan Task 16). An id that
// is not a uuid, or no such workspace, is null.
export async function getWorkspaceName(workspaceId: string): Promise<string | null> {
  if (!z.uuid().safeParse(workspaceId).success) return null;
  const [row] = await getDb()
    .db.select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, workspaceId))
    .limit(1);
  return row?.name ?? null;
}

// Every workspace id, for the worker's per-workspace jobs (idempotency.cleanup): each then runs in withWorkspace.
export async function listWorkspaceIds(db: Database = getDb().db): Promise<string[]> {
  const rows = await db.select({ id: organization.id }).from(organization).orderBy(organization.id);
  return rows.map((row) => row.id);
}
