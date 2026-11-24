import { characterCount, NUMBER_PATTERN_MAX_LENGTH, NUMBER_SEQ_MAX_WIDTH } from "../security/limits";

// Document numbering patterns (spec "Numbering": the tokens {CODE} {YYYY} {YY} {MM} {SEQ:n} plus free text; Phase 2
// plan Task 17). One parser for the settings page, its live preview and the allocator.

// How often the counter starts again at 1 (plan Q20; Charlie 2026-11-23: never, yearly or monthly, default yearly).
// The period is read in the workspace time zone (REC-08).
export const RESET_RULES = ["never", "yearly", "monthly"] as const;
export type ResetRule = (typeof RESET_RULES)[number];

export type PatternToken =
  | { kind: "text"; value: string }
  | { kind: "code" }
  | { kind: "yyyy" }
  | { kind: "yy" }
  | { kind: "mm" }
  | { kind: "seq"; width: number };

export interface ParsedPattern {
  readonly source: string;
  readonly tokens: readonly PatternToken[];
}

export type PatternError =
  | { code: "EMPTY" }
  | { code: "TOO_LONG"; max: number }
  // A {…} that is not one of the tokens, e.g. {DD} or {SEQ}.
  | { code: "UNKNOWN_TOKEN"; token: string }
  // A { with no closing }, or a } with no opening {.
  | { code: "UNMATCHED_BRACE" }
  | { code: "SEQ_WIDTH"; min: number; max: number }
  // Control or formatting characters (a bidi override would make a number display differently from what is stored).
  | { code: "INVALID_CHARACTER" }
  // Without exactly one {SEQ:n} two documents could get the same number.
  | { code: "NO_SEQ" }
  | { code: "MULTIPLE_SEQ" }
  // A counter that restarts each year or month needs that period in the number, or numbers would repeat.
  | { code: "PERIOD_MISSING"; resetRule: Exclude<ResetRule, "never"> };

export type PatternResult = { ok: true; pattern: ParsedPattern } | { ok: false; error: PatternError };

const FIXED_TOKENS: Readonly<Record<string, PatternToken>> = {
  CODE: { kind: "code" },
  YYYY: { kind: "yyyy" },
  YY: { kind: "yy" },
  MM: { kind: "mm" },
};
const SEQ_TOKEN = /^SEQ:([0-9]{1,3})$/;
const INVALID_TEXT = /[\p{Cc}\p{Cf}]/u;

const fail = (error: PatternError): PatternResult => ({ ok: false, error });

// Only the five tokens and free text are accepted (UNI-03); anything else is a typed error, never ignored.
export function parsePattern(source: string): PatternResult {
  if (source.length === 0) return fail({ code: "EMPTY" });
  if (characterCount(source) > NUMBER_PATTERN_MAX_LENGTH) return fail({ code: "TOO_LONG", max: NUMBER_PATTERN_MAX_LENGTH });
  if (INVALID_TEXT.test(source)) return fail({ code: "INVALID_CHARACTER" });

  const tokens: PatternToken[] = [];
  let rest = source;
  while (rest.length > 0) {
    const open = rest.indexOf("{");
    const close = rest.indexOf("}");
    if (open === -1) {
      if (close !== -1) return fail({ code: "UNMATCHED_BRACE" });
      tokens.push({ kind: "text", value: rest });
      break;
    }
    if (close !== -1 && close < open) return fail({ code: "UNMATCHED_BRACE" });
    if (open > 0) tokens.push({ kind: "text", value: rest.slice(0, open) });
    const end = rest.indexOf("}", open);
    if (end === -1) return fail({ code: "UNMATCHED_BRACE" });
    const name = rest.slice(open + 1, end);
    if (name.includes("{")) return fail({ code: "UNMATCHED_BRACE" });
    const fixed = FIXED_TOKENS[name];
    const seq = SEQ_TOKEN.exec(name);
    if (fixed) tokens.push(fixed);
    else if (seq) {
      const width = Number(seq[1]);
      if (width < 1 || width > NUMBER_SEQ_MAX_WIDTH) return fail({ code: "SEQ_WIDTH", min: 1, max: NUMBER_SEQ_MAX_WIDTH });
      tokens.push({ kind: "seq", width });
    } else return fail({ code: "UNKNOWN_TOKEN", token: `{${name}}` });
    rest = rest.slice(end + 1);
  }

  const seqCount = tokens.filter((token) => token.kind === "seq").length;
  if (seqCount === 0) return fail({ code: "NO_SEQ" });
  if (seqCount > 1) return fail({ code: "MULTIPLE_SEQ" });
  return { ok: true, pattern: { source, tokens } };
}

// Whether a counter under this reset rule can repeat a number: a yearly counter needs {YYYY} or {YY}, a monthly one
// also needs {MM}. Null when the pattern fits the rule.
export function checkResetRule(pattern: ParsedPattern, resetRule: ResetRule): PatternError | null {
  const has = (kind: PatternToken["kind"]) => pattern.tokens.some((token) => token.kind === kind);
  const year = has("yyyy") || has("yy");
  if (resetRule === "yearly" && !year) return { code: "PERIOD_MISSING", resetRule };
  if (resetRule === "monthly" && !(year && has("mm"))) return { code: "PERIOD_MISSING", resetRule };
  return null;
}

// Both checks, for a pattern and the rule saved with it.
export function parsePatternFor(source: string, resetRule: ResetRule): PatternResult {
  const parsed = parsePattern(source);
  if (!parsed.ok) return parsed;
  const error = checkResetRule(parsed.pattern, resetRule);
  return error ? fail(error) : parsed;
}

export function usesCode(pattern: ParsedPattern): boolean {
  return pattern.tokens.some((token) => token.kind === "code");
}

export function isResetRule(value: string): value is ResetRule {
  return (RESET_RULES as readonly string[]).includes(value);
}
