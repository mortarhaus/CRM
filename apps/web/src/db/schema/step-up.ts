import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";

// The last step-up of a session in a workspace (spec "Authorization": a fresh TOTP within the last 5 minutes; Phase 2
// plan Task 13, Q15 = A), under RLS. One row per (workspace, session): the next verification overwrites verified_at,
// and a row older than STEP_UP_WINDOW_SECONDS counts for nothing. session_id is Better Auth's session id with no
// foreign key: the session table is a system table, and a row of an ended session stays until a retention sweep
// (named in the plan review of the phase that adds the first sweeps; plan Task 13).
export const stepUp = pgTable(
  "step_up",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ name: "step_up_pkey", columns: [table.workspaceId, table.sessionId] })],
);
