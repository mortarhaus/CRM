import { EMAIL_TEMPLATE_BODY_MAX_LENGTH, EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH } from "@crm/core/security";
import { EMAIL_EVENTS } from "@crm/core/templates";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { bounded } from "./tenancy";

// A workspace's own text for one email event (spec "email_template"; Phase 2 plan Task 23), under RLS. No row means
// the event's default (core EMAIL_TEMPLATE_DEFAULTS, Q23); the row is made on the first save and never deleted:
// "restore the default" writes the default text into it. version moves on every change (optimistic concurrency).
export const emailTemplate = pgTable(
  "email_template",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    event: text("event").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "email_template_pkey", columns: [table.workspaceId, table.event] }),
    check("email_template_event_check", sql`${table.event} in (${sql.raw(EMAIL_EVENTS.map((event) => `'${event}'`).join(", "))})`),
    check("email_template_subject_check", bounded(table.subject, EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH)),
    // One header line (templateProblems refuses it first).
    check("email_template_subject_line_check", sql`${table.subject} !~ '[\\r\\n]'`),
    check("email_template_body_check", bounded(table.body, EMAIL_TEMPLATE_BODY_MAX_LENGTH)),
  ],
);
