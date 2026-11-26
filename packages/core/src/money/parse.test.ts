import { describe, expect, it } from "vitest";
import { MONEY_INPUT_MAX_LENGTH, MONEY_MAX_MINOR } from "../security/limits";
import { UnknownCurrencyError } from "./currency";
import { isMoneyParseReason, MONEY_PARSE_REASONS, MoneyParseError, type MoneyParseReason, parseDecimalToMinor } from "./parse";

function refusal(input: string, currency: string, options?: { allowNegative?: boolean }): MoneyParseReason | "accepted" {
  try {
    parseDecimalToMinor(input, currency, options);
    return "accepted";
  } catch (error) {
    if (error instanceof MoneyParseError) return error.reason;
    throw error;
  }
}

describe("parseDecimalToMinor", () => {
  it.each([
    ["1,234.50", "MYR", 123450n],
    ["1234.5", "MYR", 123450n],
    ["1234", "SGD", 123400n],
    ["0", "MYR", 0n],
    ["0.01", "MYR", 1n],
    ["  12.30  ", "MYR", 1230n],
    // Values a float multiplication by 100 gets wrong (0.29 * 100 = 28.999999999999996, 4.35 * 100 = 434.99999999999994).
    ["0.29", "MYR", 29n],
    ["4.35", "MYR", 435n],
    ["1,234,567.89", "MYR", 123456789n],
    // Leading zeros are digits like any other.
    ["007.50", "MYR", 750n],
    ["0,001.00", "MYR", 100n],
    // Exponent 0 (JPY) and 3 (KWD).
    ["1,500", "JPY", 1500n],
    ["1.5", "KWD", 1500n],
    ["1.005", "KWD", 1005n],
    ["0.001", "KWD", 1n],
  ])("%s %s is %s minor units", (input, currency, minor) => {
    expect(parseDecimalToMinor(input, currency)).toBe(minor);
  });

  it("refuses more decimals than the currency has instead of rounding", () => {
    expect(refusal("1.005", "MYR")).toBe("too_many_decimals");
    expect(refusal("1.999", "SGD")).toBe("too_many_decimals");
    expect(refusal("1.50", "MYR")).toBe("accepted");
    // Even zeros: JPY has no decimals, KWD three.
    expect(refusal("100.0", "JPY")).toBe("too_many_decimals");
    expect(refusal("1.0001", "KWD")).toBe("too_many_decimals");
  });

  it("reports the currency and its exponent with a refusal", () => {
    const error = (() => {
      try {
        parseDecimalToMinor("1.234", "MYR");
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(MoneyParseError);
    expect(error).toMatchObject({ reason: "too_many_decimals", currency: "MYR", exponent: 2 });
  });

  it.each(["", "   "])("refuses an empty value (%j)", (input) => {
    expect(refusal(input, "MYR")).toBe("empty");
  });

  it.each([
    "abc",
    "1.2.3",
    "1,23.00",
    "12,34,567",
    "1,2345",
    ",123",
    "1,",
    ".5",
    "5.",
    "+5",
    "1 000",
    "1e3",
    "0x10",
    "Infinity",
    "NaN",
    "RM 5",
    "5 MYR",
    "١٢٣",
    "１２３",
    "1_000",
    "--5",
  ])("refuses %j as not an amount", (input) => {
    expect(refusal(input, "MYR")).toBe("invalid");
  });

  it("refuses a negative amount unless it is allowed", () => {
    expect(refusal("-5.00", "MYR")).toBe("negative");
    expect(refusal("-0", "MYR")).toBe("negative");
    expect(parseDecimalToMinor("-5.25", "MYR", { allowNegative: true })).toBe(-525n);
    expect(parseDecimalToMinor("-1,000", "JPY", { allowNegative: true })).toBe(-1000n);
  });

  it("takes the largest amount exactly and refuses one minor unit more", () => {
    expect(MONEY_MAX_MINOR).toBe(999_999_999_999_999n);
    expect(parseDecimalToMinor("9,999,999,999,999.99", "MYR")).toBe(MONEY_MAX_MINOR);
    expect(parseDecimalToMinor("999999999999.999", "KWD")).toBe(MONEY_MAX_MINOR);
    expect(parseDecimalToMinor("999,999,999,999,999", "JPY")).toBe(MONEY_MAX_MINOR);
    expect(refusal("10,000,000,000,000.00", "MYR")).toBe("too_large");
    expect(refusal("1000000000000000", "JPY")).toBe("too_large");
    expect(refusal("-10000000000000.00", "MYR", { allowNegative: true })).toBe("too_large");
    expect(refusal(`${"9".repeat(30)}`, "MYR")).toBe("too_large");
    // A long text is refused before any parsing.
    expect(refusal("1".repeat(MONEY_INPUT_MAX_LENGTH + 1), "MYR")).toBe("invalid");
  });

  it("throws UnknownCurrencyError for a code outside the table, before reading the amount", () => {
    expect(() => parseDecimalToMinor("1.00", "XXX")).toThrow(UnknownCurrencyError);
    expect(() => parseDecimalToMinor("1.00", "myr")).toThrow(UnknownCurrencyError);
    expect(() => parseDecimalToMinor("", "ZZZ")).toThrow(UnknownCurrencyError);
  });
});

describe("isMoneyParseReason", () => {
  it("accepts exactly the parser's reasons", () => {
    expect(MONEY_PARSE_REASONS.every(isMoneyParseReason)).toBe(true);
    expect(["", "Invalid", "1.005", "toString", undefined, null, 1].some(isMoneyParseReason)).toBe(false);
  });
});
