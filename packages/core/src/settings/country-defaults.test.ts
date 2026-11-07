import { describe, expect, it } from "vitest";
import { COUNTRY_DEFAULTS, isSupportedCountry, SUPPORTED_COUNTRIES } from "./country-defaults";

// Phase 2 plan Task 7: every value equals the spec text (Onboarding, spec lines 731-732), and nothing the spec does
// not give is filled in (plan Q10, unanswered).
describe("COUNTRY_DEFAULTS", () => {
  it("holds only Malaysia and Singapore (plan Q11)", () => {
    expect(SUPPORTED_COUNTRIES).toEqual(["MY", "SG"]);
    expect(Object.keys(COUNTRY_DEFAULTS).sort()).toEqual(["MY", "SG"]);
  });

  it("MY: MYR, INV-{CODE}-{YYYY}-{SEQ:4}, Asia/Kuala_Lumpur, dd/mm/yyyy, Service Tax 8%", () => {
    expect(COUNTRY_DEFAULTS.MY).toEqual({
      currency: "MYR",
      invoicePattern: "INV-{CODE}-{YYYY}-{SEQ:4}",
      timezone: "Asia/Kuala_Lumpur",
      dateFormat: "dd/mm/yyyy",
      locale: null,
      taxName: "Service Tax",
      taxRateBps: 800,
    });
  });

  it("SG: SGD, Asia/Singapore, GST 9%; the invoice pattern, date format and locale are unresolved", () => {
    expect(COUNTRY_DEFAULTS.SG).toEqual({
      currency: "SGD",
      invoicePattern: null,
      timezone: "Asia/Singapore",
      dateFormat: null,
      locale: null,
      taxName: "GST",
      taxRateBps: 900,
    });
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
