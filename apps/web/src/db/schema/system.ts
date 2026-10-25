import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
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
