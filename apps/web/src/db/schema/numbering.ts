import { NUMBER_PATTERN_MAX_LENGTH } from "@crm/core/security";
import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";

// One counter per workspace and document type (spec Data model "doc_sequence"; Phase 2 plan Task 18), under RLS.
// A number is taken only by allocateNumber, under SELECT … FOR UPDATE on this row, in the issuing transaction
// (spec "Numbering", REC-06, REC-07). Only the invoice in Phase 2; each later type is added by the phase that
// issues it (plan Q20). version moves only with a settings change (pattern or reset rule), never with a number.
export const docSequence = pgTable(
  "doc_sequence",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    docType: text("doc_type").notNull(),
    pattern: text("pattern").notNull(),
    resetRule: text("reset_rule").notNull(),
    counter: integer("counter").notNull().default(0),
    lastResetPeriod: text("last_reset_period"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: "doc_sequence_pkey", columns: [table.workspaceId, table.docType] }),
    check("doc_sequence_doc_type_check", sql`${table.docType} in ('invoice')`),
    // The app parses the pattern (parsePattern); the column bounds its length in code points.
    check(
      "doc_sequence_pattern_check",
      sql`char_length(${table.pattern}) between 1 and ${sql.raw(String(NUMBER_PATTERN_MAX_LENGTH))}`,
    ),
    check("doc_sequence_reset_rule_check", sql`${table.resetRule} in ('never', 'yearly', 'monthly')`),
    check("doc_sequence_counter_check", sql`${table.counter} >= 0`),
    // periodKey: 'never', a year (2026) or a year and month (2026-01).
    check("doc_sequence_last_reset_period_check", sql`${table.lastResetPeriod} ~ '^(never|[0-9]{4}|[0-9]{4}-[0-9]{2})$'`),
  ],
);
