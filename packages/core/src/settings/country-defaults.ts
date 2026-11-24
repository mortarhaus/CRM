import type { ResetRule } from "../numbering/pattern";

// Country defaults applied to workspace_settings at onboarding (spec "Onboarding", lines 731-732; Phase 2 plan Task 7;
// the module's location is DECISIONS 2026-11-06). The values are the spec's, except those Charlie set for plan Q10
// (below). A null value would mean UNRESOLVED, not a default: nothing is written for it. None is null today.
//
// Plan Q10 (Charlie, 2026-11-08): the SG invoice pattern is MY's; the date format is dd-mmm-yyyy for both countries,
// whatever the locale; the locale is plain "en" for both. The date format is a default: the owner can change it.
//
// The tax rates are pending professional check (spec "Verify with professionals before Phase 4 goes live" -> SST,
// line 1176; PROJECT.md §11). They are editable defaults, never a rule.
//
// The invoice reset rule (Charlie, 2026-11-23): yearly for both countries, in the workspace time zone.

export const SUPPORTED_COUNTRIES = ["MY", "SG"] as const;
export type Country = (typeof SUPPORTED_COUNTRIES)[number];

export interface CountryDefaults {
  // ISO 4217, used for both the base and the default currency.
  currency: string;
  // Seeded into the invoice doc_sequence at onboarding (plan Task 18); not a workspace_settings column.
  invoicePattern: string | null;
  // How often the invoice counter starts again at 1; seeded with the pattern.
  invoiceResetRule: ResetRule;
  // IANA time zone.
  timezone: string;
  dateFormat: string | null;
  locale: string | null;
  // Preselected only when the owner answers Yes to the SST/GST question; the owner can edit both.
  taxName: string;
  // Basis points (spec Money rules "Representation": 8% = 800).
  taxRateBps: number;
}

export const COUNTRY_DEFAULTS: Readonly<Record<Country, Readonly<CountryDefaults>>> = {
  MY: {
    currency: "MYR",
    invoicePattern: "INV-{CODE}-{YYYY}-{SEQ:4}",
    invoiceResetRule: "yearly",
    timezone: "Asia/Kuala_Lumpur",
    dateFormat: "dd-mmm-yyyy",
    locale: "en",
    taxName: "Service Tax",
    taxRateBps: 800, // pending professional check
  },
  SG: {
    currency: "SGD",
    invoicePattern: "INV-{CODE}-{YYYY}-{SEQ:4}",
    invoiceResetRule: "yearly",
    timezone: "Asia/Singapore",
    dateFormat: "dd-mmm-yyyy",
    locale: "en",
    taxName: "GST",
    taxRateBps: 900, // pending professional check
  },
};

export function isSupportedCountry(value: string): value is Country {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(value);
}

// The currencies a settings form may choose until the money module (Phase 2 PR 7) brings ISO 4217 (plan Task 9): the
// supported countries' own (spec line 731). A test keeps it equal to COUNTRY_DEFAULTS.
export const SETTINGS_CURRENCIES = ["MYR", "SGD"] as const;
export type SettingsCurrency = (typeof SETTINGS_CURRENCIES)[number];

// The date formats an owner may choose (plan Q10, Charlie 2026-11-08: a default per country, changeable). `mmm` is the
// English three-letter month whatever the locale (08-Nov-2026). A test keeps every country default in this list.
export const DATE_FORMATS = ["dd-mmm-yyyy", "dd/mm/yyyy", "yyyy-mm-dd"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
// Shown beside each format in the settings select: the same date, 8 November 2026, written each way.
export const DATE_FORMAT_EXAMPLES: Readonly<Record<DateFormat, string>> = {
  "dd-mmm-yyyy": "08-Nov-2026",
  "dd/mm/yyyy": "08/11/2026",
  "yyyy-mm-dd": "2026-11-08",
};
