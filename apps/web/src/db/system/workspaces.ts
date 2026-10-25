import type { Database } from "../client";
import { workspaceSettings } from "../schema";
import { runInWorkspace } from "../workspace";

// Better Auth writes the organization row in its own statement first, so this runs as a second write.
// It is idempotent: a workspace whose row is missing (a crash between the two writes) can be healed on
// first use (plan Risk 6).
export function ensureWorkspaceSettings(db: Database, workspaceId: string): Promise<void> {
  return runInWorkspace(db, workspaceId, async (tx) => {
    await tx.insert(workspaceSettings).values({ workspaceId }).onConflictDoNothing();
  });
}
