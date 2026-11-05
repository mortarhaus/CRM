import {
  ADDRESS_LINE_MAX_LENGTH,
  EMAIL_ADDRESS_MAX_LENGTH,
  SETTINGS_TEXT_MAX_LENGTH,
  SHORT_CODE_MAX_LENGTH,
  SHORT_CODE_MIN_LENGTH,
} from "@crm/core/security";
import { type AnyColumn, type SQL, sql } from "drizzle-orm";
import { boolean, char, check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";

// A stored text value is 1 to max code points; an empty value is stored as null.
const bounded = (column: AnyColumn, max: number): SQL => sql`char_length(${column}) between 1 and ${sql.raw(String(max))}`;

// One row per workspace, under RLS (spec Tenancy). The spec line-460 columns except bank details, duitnow_qr_key
// (Phase 2 PR 5) and proposal cover options (Phase 6, plan Q24). Every column is nullable or defaulted, so a row made
// before Phase 2 stays valid (UNI-15); defaults are only the spec's own. Business values are applied by the country
// defaults at onboarding (Phase 2 PR 3), never here.
export const workspaceSettings = pgTable(
  "workspace_settings",
  {
    workspaceId: uuid("workspace_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "restrict" }),
    shortCode: text("short_code"),
    logoKey: text("logo_key"),
    brandColour: text("brand_colour"),
    // Structured address (plan Q11). Its country is the workspace country below.
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    addressCity: text("address_city"),
    addressPostcode: text("address_postcode"),
    addressState: text("address_state"),
    country: char("country", { length: 2 }),
    timezone: text("timezone"),
    locale: text("locale"),
    dateFormat: text("date_format"),
    baseCurrency: char("base_currency", { length: 3 }),
    defaultCurrency: char("default_currency", { length: 3 }),
    taxRegistered: boolean("tax_registered").notNull().default(false),
    taxRegistrationNo: text("tax_registration_no"),
    ownTin: text("own_tin"),
    ownBrn: text("own_brn"),
    defaultTaxName: text("default_tax_name"),
    // Basis points, integer (spec Money rules "Representation": 8% = 800).
    defaultTaxRateBps: integer("default_tax_rate_bps"),
    taxRounding: text("tax_rounding").notNull().default("rate_group"),
    emailFromName: text("email_from_name"),
    emailReplyTo: text("email_reply_to"),
    emailBccSelf: boolean("email_bcc_self"),
    autoSendDefault: boolean("auto_send_default"),
    defaultAgreementPattern: text("default_agreement_pattern").notNull().default("service_agreement"),
    require2fa: boolean("require_2fa").notNull().default(false),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "workspace_settings_short_code_check",
      sql`${table.shortCode} ~ ${sql.raw(`'^[A-Z0-9]{${SHORT_CODE_MIN_LENGTH},${SHORT_CODE_MAX_LENGTH}}$'`)}`,
    ),
    // FILE-03: an upload key ws/{workspace_id}/{uuid}, and only in this workspace's own prefix.
    check(
      "workspace_settings_logo_key_check",
      sql`${table.logoKey} ~ ('^ws/' || ${table.workspaceId}::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')`,
    ),
    // Lower-case hex only, so the value can never carry CSS (UNI-03; the brand token is rendered in PR 2b).
    check("workspace_settings_brand_colour_check", sql`${table.brandColour} ~ '^#[0-9a-f]{6}$'`),
    check("workspace_settings_address_line1_check", bounded(table.addressLine1, ADDRESS_LINE_MAX_LENGTH)),
    check("workspace_settings_address_line2_check", bounded(table.addressLine2, ADDRESS_LINE_MAX_LENGTH)),
    check("workspace_settings_address_city_check", bounded(table.addressCity, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_address_postcode_check", bounded(table.addressPostcode, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_address_state_check", bounded(table.addressState, SETTINGS_TEXT_MAX_LENGTH)),
    // ISO 3166-1 alpha-2 shape; which countries are selectable is the app's rule (Zod), not the column's.
    check("workspace_settings_country_check", sql`${table.country} ~ '^[A-Z]{2}$'`),
    check("workspace_settings_timezone_check", bounded(table.timezone, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_locale_check", bounded(table.locale, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_date_format_check", bounded(table.dateFormat, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_base_currency_check", sql`${table.baseCurrency} ~ '^[A-Z]{3}$'`),
    check("workspace_settings_default_currency_check", sql`${table.defaultCurrency} ~ '^[A-Z]{3}$'`),
    check("workspace_settings_tax_registration_no_check", bounded(table.taxRegistrationNo, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_own_tin_check", bounded(table.ownTin, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_own_brn_check", bounded(table.ownBrn, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_default_tax_name_check", bounded(table.defaultTaxName, SETTINGS_TEXT_MAX_LENGTH)),
    // Spec line 460 and Money rules: the default rate is never below 0, with no upper bound.
    check("workspace_settings_default_tax_rate_bps_check", sql`${table.defaultTaxRateBps} >= 0`),
    // The default tax is used only when the workspace is tax-registered (spec line 460).
    check(
      "workspace_settings_default_tax_check",
      sql`${table.taxRegistered} or (${table.defaultTaxName} is null and ${table.defaultTaxRateBps} is null)`,
    ),
    // Only rate_group until Phase 4 (plan Q25).
    check("workspace_settings_tax_rounding_check", sql`${table.taxRounding} = 'rate_group'`),
    check("workspace_settings_email_from_name_check", bounded(table.emailFromName, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_email_reply_to_check", bounded(table.emailReplyTo, EMAIL_ADDRESS_MAX_LENGTH)),
    check(
      "workspace_settings_default_agreement_pattern_check",
      sql`${table.defaultAgreementPattern} in ('service_agreement', 'msa_sow')`,
    ),
  ],
);
