import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// The domain event history (spec "Domain events and jobs"; plan Task 19): append-only, under RLS, written by
// emitEvent (src/jobs/enqueue.ts) in the same transaction as the change and as its pg-boss job. The payload holds
// IDs and amounts only (amounts as decimal strings, MON-03).
export const domainEvent = pgTable(
  "domain_event",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("domain_event_workspace_id_created_at_idx").on(table.workspaceId, table.createdAt)],
);

// In-app notifications, under RLS. No producer in Phase 1 (the first is owner notifications, Phase 7).
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("notification_workspace_id_user_id_read_at_idx").on(table.workspaceId, table.userId, table.readAt)],
);
