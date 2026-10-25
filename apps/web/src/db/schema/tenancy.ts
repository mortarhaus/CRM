import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";

// One row per workspace, under RLS (spec Tenancy). Phase 1 holds no settings yet; each later phase adds
// the columns it builds (UNI-15).
export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
