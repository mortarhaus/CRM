import { CURRENCY_CODES } from "@crm/core/money";
import {
  MONEY_MAX_MINOR,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_UNIT_MAX_LENGTH,
} from "@crm/core/security";
import { sql } from "drizzle-orm";
import { bigint, boolean, char, check, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { bounded } from "./tenancy";

// The catalog (spec Data model "Catalog"; Phase 2 plan Task 21), under RLS. A service is never deleted, only archived
// (plan Q22). Its default unit price is in its own currency (MON-02, spec v4.6), in minor units as a bigint (MON-01);
// the currency cannot change while a price is set (spec Money rules "Service currency edit"): the action refuses it and
// the trigger of migration 0036 refuses it for every other path. version moves on every change (optimistic
// concurrency).
export const service = pgTable(
  "service",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    defaultDescription: text("default_description"),
    defaultUnitPriceMinor: bigint("default_unit_price_minor", { mode: "bigint" }),
    currency: char("currency", { length: 3 }).notNull(),
    unit: text("unit"),
    defaultTaxable: boolean("default_taxable").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The target of the composite foreign keys of later tables (line items, spec Tenancy).
    unique("service_workspace_id_id_key").on(table.workspaceId, table.id),
    check("service_name_check", bounded(table.name, SERVICE_NAME_MAX_LENGTH)),
    check("service_default_description_check", bounded(table.defaultDescription, SERVICE_DESCRIPTION_MAX_LENGTH)),
    check("service_unit_check", bounded(table.unit, SERVICE_UNIT_MAX_LENGTH)),
    check(
      "service_default_unit_price_minor_check",
      sql`${table.defaultUnitPriceMinor} between 0 and ${sql.raw(MONEY_MAX_MINOR.toString())}`,
    ),
    // ISO 4217 codes with a minor unit, as CURRENCY_EXPONENT (core money).
    check("service_currency_check", sql`${table.currency} in (${sql.raw(CURRENCY_CODES.map((code) => `'${code}'`).join(", "))})`),
  ],
);
