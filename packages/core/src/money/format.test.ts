import { describe, expect, it } from "vitest";
import { CURRENCY_CODES, CURRENCY_EXPONENT, currencyExponent, isCurrency, PICKER_CURRENCIES, UnknownCurrencyError } from "./currency";
import { formatMinor, minorToDecimal } from "./format";
import { parseDecimalToMinor } from "./parse";

describe("CURRENCY_EXPONENT", () => {
  it("holds ISO 4217 codes with their minor units, not a default of 2", () => {
    expect(CURRENCY_CODES.length).toBe(155);
    expect(CURRENCY_CODES.every((code) => /^[A-Z]{3}$/.test(code))).toBe(true);
    expect([currencyExponent("MYR"), currencyExponent("SGD"), currencyExponent("USD")]).toEqual([2, 2, 2]);
    expect([currencyExponent("JPY"), currencyExponent("KRW"), currencyExponent("VND")]).toEqual([0, 0, 0]);
    expect([currencyExponent("KWD"), currencyExponent("BHD"), currencyExponent("OMR")]).toEqual([3, 3, 3]);
    expect(new Set(Object.values(CURRENCY_EXPONENT))).toEqual(new Set([0, 2, 3]));
  });

  it("leaves out fund codes and units with no minor unit", () => {
    for (const code of ["XXX", "XTS", "XAU", "XDR", "CLF", "USN", "BOV"]) expect(isCurrency(code)).toBe(false);
    expect(() => currencyExponent("XAU")).toThrow(UnknownCurrencyError);
    // Not on the prototype either.
    expect(isCurrency("toString")).toBe(false);
  });

  it("lists MYR and SGD first for a picker, then every other code A to Z, each once", () => {
    expect(PICKER_CURRENCIES.slice(0, 3)).toEqual(["MYR", "SGD", "AED"]);
    expect([...PICKER_CURRENCIES].sort()).toEqual([...CURRENCY_CODES]);
  });
});

describe("minorToDecimal", () => {
  it.each([
    [123450n, "MYR", "1234.50"],
    [5n, "MYR", "0.05"],
    [0n, "MYR", "0.00"],
    [-525n, "MYR", "-5.25"],
    [1500n, "JPY", "1500"],
    [1005n, "KWD", "1.005"],
    [-5n, "KWD", "-0.005"],
    // Past Number.MAX_SAFE_INTEGER (2^53 - 1): exact, digit for digit.
    [9_007_199_254_740_993n, "MYR", "90071992547409.93"],
  ])("%s %s is %s", (minor, currency, text) => {
    expect(minorToDecimal(minor, currency)).toBe(text);
  });

  it("is read back by parseDecimalToMinor to the same minor units", () => {
    for (const [minor, currency] of [
      [999_999_999_999_999n, "MYR"],
      [1n, "KWD"],
      [42n, "JPY"],
    ] as const) {
      expect(parseDecimalToMinor(minorToDecimal(minor, currency), currency)).toBe(minor);
    }
  });
});

describe("formatMinor", () => {
  // Intl puts a no-break space between the code and the amount.
  it("formats in the locale with the currency's own number of decimals", () => {
    expect(formatMinor(123450n, "MYR", "en")).toBe("MYR\u00a01,234.50");
    expect(formatMinor(123450n, "SGD", "en")).toBe("SGD\u00a01,234.50");
    expect(formatMinor(1500n, "JPY", "en")).toBe("¥1,500");
    expect(formatMinor(1005n, "KWD", "en")).toBe("KWD\u00a01.005");
    expect(formatMinor(0n, "MYR", "en")).toBe("MYR\u00a00.00");
  });

  it("loses no digit at any size (no float on the way)", () => {
    expect(formatMinor(999_999_999_999_999n, "MYR", "en")).toBe("MYR\u00a09,999,999,999,999.99");
    // A Number would print 90,071,992,547,409.92 here.
    expect(formatMinor(9_007_199_254_740_993n, "MYR", "en")).toBe("MYR\u00a090,071,992,547,409.93");
  });
});
