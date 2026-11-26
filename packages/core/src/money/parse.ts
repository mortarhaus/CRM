import { MONEY_INPUT_MAX_LENGTH, MONEY_MAX_MINOR } from "../security/limits";
import { currencyExponent } from "./currency";

// Why a typed amount was refused. Nothing is ever rounded: more decimals than the currency has is a refusal.
export const MONEY_PARSE_REASONS = ["empty", "invalid", "negative", "too_many_decimals", "too_large"] as const;
export type MoneyParseReason = (typeof MONEY_PARSE_REASONS)[number];

export const isMoneyParseReason = (value: unknown): value is MoneyParseReason => (MONEY_PARSE_REASONS as readonly unknown[]).includes(value);

export class MoneyParseError extends Error {
  constructor(
    readonly reason: MoneyParseReason,
    readonly currency: string,
    readonly exponent: number,
  ) {
    super(`amount refused (${reason}) for ${currency}`);
    this.name = "MoneyParseError";
  }
}

// ASCII digits only, either plain or grouped in threes with commas (1234 or 1,234, never 1,23 or 12,34,567); then an
// optional point and at least one decimal. No plus sign, spaces inside, exponent or other separators.
const AMOUNT = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;

// A typed amount ("1,234.50") to integer minor units in the currency's exponent (123450n for MYR), by string
// arithmetic only: no value passes through a float (MON-01). Leading zeros are allowed. Throws MoneyParseError when
// the text is empty, not an amount, negative (unless allowed), has more decimals than the currency's exponent, or is
// above MONEY_MAX_MINOR; UnknownCurrencyError for a code not in CURRENCY_EXPONENT.
export function parseDecimalToMinor(input: string, currency: string, options: { allowNegative?: boolean } = {}): bigint {
  const exponent = currencyExponent(currency);
  const refuse = (reason: MoneyParseReason) => new MoneyParseError(reason, currency, exponent);
  const text = input.trim();
  if (text === "") throw refuse("empty");
  const match = text.length <= MONEY_INPUT_MAX_LENGTH ? AMOUNT.exec(text) : null;
  if (!match) throw refuse("invalid");
  const [, sign, whole = "", fraction = ""] = match;
  if (sign !== undefined && options.allowNegative !== true) throw refuse("negative");
  if (fraction.length > exponent) throw refuse("too_many_decimals");
  const magnitude = BigInt(whole.replaceAll(",", "") + fraction.padEnd(exponent, "0"));
  if (magnitude > MONEY_MAX_MINOR) throw refuse("too_large");
  return sign !== undefined ? -magnitude : magnitude;
}
