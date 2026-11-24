import { describe, expect, it } from "vitest";
import { parsePatternFor } from "../numbering/pattern";
import { COUNTRY_DEFAULTS, DATE_FORMAT_EXAMPLES, DATE_FORMATS, isSupportedCountry, SETTINGS_CURRENCIES, SUPPORTED_COUNTRIES } from "./country-defaults";

// Phase 2 plan Task 7: every value equals the spec text (Onboarding, spec lines 731-732) or Charlie's plan Q10 answer
// (2026-11-08: SG pattern as MY, date format dd-mmm-yyyy for both, locale "en" for both).
describe("COUNTRY_DEFAULTS", () => {
  it("holds only Malaysia and Singapore (plan Q11)", () => {
    expect(SUPPORTED_COUNTRIES).toEqual(["MY", "SG"]);
    expect(Object.keys(COUNTRY_DEFAULTS).sort()).toEqual(["MY", "SG"]);
  });

  it("MY: MYR, INV-{CODE}-{YYYY}-{SEQ:4}, Asia/Kuala_Lumpur, dd-mmm-yyyy, en, Service Tax 8%", () => {
    expect(COUNTRY_DEFAULTS.MY).toEqual({
      currency: "MYR",
      invoicePattern: "INV-{CODE}-{YYYY}-{SEQ:4}",
      invoiceResetRule: "yearly",
      timezone: "Asia/Kuala_Lumpur",
      dateFormat: "dd-mmm-yyyy",
      locale: "en",
      taxName: "Service Tax",
      taxRateBps: 800,
    });
  });

  it("SG: SGD, Asia/Singapore, INV-{CODE}-{YYYY}-{SEQ:4}, dd-mmm-yyyy, en, GST 9%", () => {
    expect(COUNTRY_DEFAULTS.SG).toEqual({
      currency: "SGD",
      invoicePattern: "INV-{CODE}-{YYYY}-{SEQ:4}",
      invoiceResetRule: "yearly",
      timezone: "Asia/Singapore",
      dateFormat: "dd-mmm-yyyy",
      locale: "en",
      taxName: "GST",
      taxRateBps: 900,
    });
  });

  // Charlie 2026-11-23: the invoice counter resets yearly; the seeded pattern must parse under that rule.
  it("seeds an invoice pattern that parses under its reset rule", () => {
    for (const country of SUPPORTED_COUNTRIES) {
      const { invoicePattern, invoiceResetRule } = COUNTRY_DEFAULTS[country];
      expect(invoicePattern && parsePatternFor(invoicePattern, invoiceResetRule).ok).toBe(true);
    }
  });

  it("names a real IANA timezone for each country", () => {
    for (const country of SUPPORTED_COUNTRIES) {
      expect(Intl.supportedValuesOf("timeZone")).toContain(COUNTRY_DEFAULTS[country].timezone);
    }
  });
});

describe("isSupportedCountry", () => {
  it.each(["MY", "SG"])("accepts %s", (value) => expect(isSupportedCountry(value)).toBe(true));
  it.each(["my", "US", "", "MYS", "__proto__", "toString"])("refuses %j", (value) => expect(isSupportedCountry(value)).toBe(false));
});

// Phase 2 plan Task 9: until the money module (PR 7) brings an ISO 4217 list, a currency setting is one of the
// supported countries' currencies.
describe("SETTINGS_CURRENCIES", () => {
  it("is exactly the currencies of the country defaults", () => {
    expect([...SETTINGS_CURRENCIES].sort()).toEqual([...new Set(Object.values(COUNTRY_DEFAULTS).map((d) => d.currency))].sort());
  });
});

describe("DATE_FORMATS", () => {
  it("lists every country's default date format, once each", () => {
    for (const country of SUPPORTED_COUNTRIES) {
      expect(DATE_FORMATS as readonly (string | null)[]).toContain(COUNTRY_DEFAULTS[country].dateFormat);
    }
    expect(new Set(DATE_FORMATS).size).toBe(DATE_FORMATS.length);
  });

  it("has one distinct example per format", () => {
    expect(Object.keys(DATE_FORMAT_EXAMPLES).sort()).toEqual([...DATE_FORMATS].sort());
    expect(new Set(Object.values(DATE_FORMAT_EXAMPLES)).size).toBe(DATE_FORMATS.length);
  });
});
