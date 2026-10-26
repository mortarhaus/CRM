import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

// The billing owner of one or more workspaces (spec Data model, "Accounts and workspaces"). A system table:
// no RLS, reached only through src/db/system. Part 1 has one billing account per owner, on the free plan
// only (locked switch until Part 3); `status` holds only `active` until Charlie answers ASK 5.
export const billingAccount = pgTable(
  "billing_account",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    limits: jsonb("limits").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("billing_account_owner_user_id_unique").on(table.ownerUserId),
    check("billing_account_plan_check", sql`${table.plan} = 'free'`),
    check("billing_account_status_check", sql`${table.status} = 'active'`),
  ],
);

// One row per login, 2FA change or recovery-code change of a user (spec Data model, `auth_audit_log`; plan Task 31).
// A system table: no RLS, no workspace, append-only (crm_app holds INSERT only, and only the triggers of migration
// 0009 write it). The event names and `detail` labels are in src/db/system/auth-audit.ts.
export const authAuditLog = pgTable(
  "auth_audit_log",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    event: text("event").notNull(),
    detail: jsonb("detail"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("auth_audit_log_user_id_created_at_idx").on(table.userId, table.createdAt),
    check(
      "auth_audit_log_event_check",
      sql`${table.event} in ('session_issued', 'two_factor_verified', 'two_factor_enabled', 'two_factor_disabled', 'two_factor_backup_codes_changed')`,
    ),
    check("auth_audit_log_detail_check", sql`${table.detail} is null or jsonb_typeof(${table.detail}) = 'object'`),
  ],
);
