import { currencyExponent } from "./currency";

// Minor units back to a plain decimal string in the currency's exponent (123450n MYR -> "1234.50", 5n JPY -> "5",
// -5n KWD -> "-0.005"), by string arithmetic only (MON-01, MON-03). For a form field that shows a stored amount.
export function minorToDecimal(minor: bigint, currency: string): string {
  const exponent = currencyExponent(currency);
  const digits = (minor < 0n ? -minor : minor).toString().padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = digits.slice(digits.length - exponent);
  return `${minor < 0n ? "-" : ""}${whole}${exponent > 0 ? `.${fraction}` : ""}`;
}

// An amount for display in a locale ("MYR 1,234.50" in en). Intl.NumberFormat is given the exact decimal string, never a
// Number, so no digit is lost at any size, and always the currency's ISO 4217 exponent as its decimal places.
export function formatMinor(minor: bigint, currency: string, locale: string): string {
  const exponent = currencyExponent(currency);
  const format = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  return format.format(minorToDecimal(minor, currency) as Intl.StringNumericLiteral);
}
