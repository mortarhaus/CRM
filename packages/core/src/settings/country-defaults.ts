// Country defaults applied to workspace_settings at onboarding (spec "Onboarding", lines 731-732; Phase 2 plan Task 7;
// the module's location is DECISIONS 2026-11-06). The values are the spec's, except those Charlie set for plan Q10
// (below). A null value would mean UNRESOLVED, not a default: nothing is written for it. None is null today.
//
// Plan Q10 (Charlie, 2026-11-08): the SG invoice pattern is MY's; the date format is dd-mmm-yyyy for both countries,
// whatever the locale; the locale is plain "en" for both. The date format is a default: the owner can change it.
//
// The tax rates are pending professional check (spec "Verify with professionals before Phase 4 goes live" -> SST,
// line 1176; PROJECT.md §11). They are editable defaults, never a rule.

export const SUPPORTED_COUNTRIES = ["MY", "SG"] as const;
export type Country = (typeof SUPPORTED_COUNTRIES)[number];

export interface CountryDefaults {
  // ISO 4217, used for both the base and the default currency.
  currency: string;
  // Seeded into the invoice doc_sequence by the numbering PR (plan Task 18); not a workspace_settings column.
  invoicePattern: string | null;
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
    timezone: "Asia/Kuala_Lumpur",
    dateFormat: "dd-mmm-yyyy",
    locale: "en",
    taxName: "Service Tax",
    taxRateBps: 800, // pending professional check
  },
  SG: {
    currency: "SGD",
    invoicePattern: "INV-{CODE}-{YYYY}-{SEQ:4}",
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
