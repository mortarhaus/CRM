import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// The workspace audit trail (spec "Audit, logging, privacy"; plan Task 12): append-only, under RLS. crm_app and
// crm_purge insert (migration 0012); nobody but the owner updates, deletes or truncates. Rows are written only by
// recordAudit (src/lib/audit.ts), which takes workspace_id from the transaction's setting and redacts PII.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_log_workspace_id_created_at_idx").on(table.workspaceId, table.createdAt)],
);
