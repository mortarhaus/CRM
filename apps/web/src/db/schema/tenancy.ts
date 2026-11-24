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
export const bounded = (column: AnyColumn, max: number): SQL => sql`char_length(${column}) between 1 and ${sql.raw(String(max))}`;

// One row per workspace, under RLS (spec Tenancy). The spec line-460 columns except proposal cover options (Phase 6,
// plan Q24). Every column is nullable or defaulted, so a row made
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
    // Bank details (Phase 2 PR 5b; plan Q17, Charlie 2026-11-22): bank name, account holder and account number are
    // set together or not at all; the SWIFT code and the payment QR are optional. Owner only, with step-up.
    bankName: text("bank_name"),
    bankAccountHolder: text("bank_account_holder"),
    bankAccountNumber: text("bank_account_number"),
    bankSwiftCode: text("bank_swift_code"),
    // The payment QR (DuitNow in MY, PayNow in SG), content-addressed and never deleted (spec line 847).
    duitnowQrKey: text("duitnow_qr_key"),
    // The last change to the bank details or the QR: invoices print "Bank details updated on {date}" (Phase 4).
    bankDetailsChangedAt: timestamp("bank_details_changed_at", { withTimezone: true }),
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
    // The default tax is a name with its rate: both set or both empty (plan Task 9; a name without a rate, or a rate
    // without a name, cannot be applied to a new document).
    check(
      "workspace_settings_default_tax_pair_check",
      sql`(${table.defaultTaxName} is null) = (${table.defaultTaxRateBps} is null)`,
    ),
    // A Yes to the SST/GST question requires the registration number (spec line 732; Phase 2 plan PR 3).
    check(
      "workspace_settings_tax_registration_required_check",
      sql`not ${table.taxRegistered} or ${table.taxRegistrationNo} is not null`,
    ),
    // Only rate_group until Phase 4 (plan Q25).
    check("workspace_settings_tax_rounding_check", sql`${table.taxRounding} = 'rate_group'`),
    check("workspace_settings_email_from_name_check", bounded(table.emailFromName, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_email_reply_to_check", bounded(table.emailReplyTo, EMAIL_ADDRESS_MAX_LENGTH)),
    check("workspace_settings_bank_name_check", bounded(table.bankName, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_bank_account_holder_check", bounded(table.bankAccountHolder, SETTINGS_TEXT_MAX_LENGTH)),
    check("workspace_settings_bank_account_number_check", bounded(table.bankAccountNumber, SETTINGS_TEXT_MAX_LENGTH)),
    check(
      "workspace_settings_bank_details_check",
      sql`(${table.bankName} is null) = (${table.bankAccountHolder} is null) and (${table.bankName} is null) = (${table.bankAccountNumber} is null)`,
    ),
    // ISO 9362 BIC: 8 or 11 characters, upper case.
    check("workspace_settings_bank_swift_code_check", sql`${table.bankSwiftCode} ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'`),
    // The FILE-03 exception (PROJECT.md §9): ws/{workspace_id}/duitnow/{sha256}.{png|jpg}, in this workspace's prefix.
    check(
      "workspace_settings_duitnow_qr_key_check",
      sql`${table.duitnowQrKey} ~ ('^ws/' || ${table.workspaceId}::text || '/duitnow/[0-9a-f]{64}\\.(png|jpg)$')`,
    ),
    check(
      "workspace_settings_default_agreement_pattern_check",
      sql`${table.defaultAgreementPattern} in ('service_agreement', 'msa_sow')`,
    ),
  ],
);
