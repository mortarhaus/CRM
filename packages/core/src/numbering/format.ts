import type { ParsedPattern, ResetRule } from "./pattern";

export class MissingCodeError extends Error {
  constructor() {
    super("the pattern uses {CODE} and the workspace has no short code");
    this.name = "MissingCodeError";
  }
}

export interface NumberInput {
  // The workspace short code; null when none is set (only a pattern without {CODE} can then be formatted).
  code: string | null;
  // The counter value of this document, from 1.
  seq: number;
  // The instant the number is assigned (or previewed for).
  at: Date;
  // The workspace IANA time zone: period tokens use it, never the server's (REC-08).
  timeZone: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

// The calendar year and month of an instant in a time zone, as digits ("2026", "01").
export function zonedYearMonth(at: Date, timeZone: string): { year: string; month: string } {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", numberingSystem: "latn" });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(at);
  const part = (type: "year" | "month") => {
    const value = parts.find((item) => item.type === type)?.value;
    if (value === undefined) throw new Error(`no ${type} for ${at.toISOString()} in ${timeZone}`);
    return value;
  };
  return { year: part("year").padStart(4, "0"), month: part("month") };
}

// The one formatter (plan Risk 4): the settings preview, previewNumber and allocateNumber all call it.
export function formatNumber(pattern: ParsedPattern, input: NumberInput): string {
  if (!Number.isSafeInteger(input.seq) || input.seq < 1) throw new RangeError("seq must be a positive integer");
  const { year, month } = zonedYearMonth(input.at, input.timeZone);
  return pattern.tokens
    .map((token) => {
      switch (token.kind) {
        case "text":
          return token.value;
        case "code":
          if (input.code === null) throw new MissingCodeError();
          return input.code;
        case "yyyy":
          return year;
        case "yy":
          return year.slice(-2);
        case "mm":
          return month;
        case "seq":
          // A minimum width: a counter past it prints all its digits, never a cut number.
          return String(input.seq).padStart(token.width, "0");
      }
    })
    .join("");
}

const NEVER_PERIOD = "never";

// The period an instant falls in under a reset rule, in the workspace time zone: "2026" (yearly), "2026-01"
// (monthly), or one constant (never). The counter starts again at 1 when this differs from the stored period.
export function periodKey(resetRule: ResetRule, at: Date, timeZone: string): string {
  if (resetRule === "never") return NEVER_PERIOD;
  const { year, month } = zonedYearMonth(at, timeZone);
  return resetRule === "yearly" ? year : `${year}-${month}`;
}
