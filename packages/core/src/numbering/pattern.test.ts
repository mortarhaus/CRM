import { describe, expect, it } from "vitest";
import { NUMBER_PATTERN_MAX_LENGTH, NUMBER_SEQ_MAX_WIDTH } from "../security/limits";
import { checkResetRule, parsePattern, parsePatternFor } from "./pattern";

const parsed = (source: string) => {
  const result = parsePattern(source);
  if (!result.ok) throw new Error(`refused: ${JSON.stringify(result.error)}`);
  return result.pattern;
};

describe("parsePattern", () => {
  it("reads the five tokens and the free text between them", () => {
    expect(parsed("INV-{CODE}-{YYYY}/{YY}{MM}-{SEQ:4}").tokens).toEqual([
      { kind: "text", value: "INV-" },
      { kind: "code" },
      { kind: "text", value: "-" },
      { kind: "yyyy" },
      { kind: "text", value: "/" },
      { kind: "yy" },
      { kind: "mm" },
      { kind: "text", value: "-" },
      { kind: "seq", width: 4 },
    ]);
  });

  it.each([
    ["{DD}-{SEQ:4}", { code: "UNKNOWN_TOKEN", token: "{DD}" }],
    ["{code}-{SEQ:4}", { code: "UNKNOWN_TOKEN", token: "{code}" }],
    ["INV-{SEQ}", { code: "UNKNOWN_TOKEN", token: "{SEQ}" }],
    ["INV-{SEQ:x}", { code: "UNKNOWN_TOKEN", token: "{SEQ:x}" }],
    ["INV-{}-{SEQ:4}", { code: "UNKNOWN_TOKEN", token: "{}" }],
    ["INV-{SEQ:0}", { code: "SEQ_WIDTH", min: 1, max: NUMBER_SEQ_MAX_WIDTH }],
    [`INV-{SEQ:${NUMBER_SEQ_MAX_WIDTH + 1}}`, { code: "SEQ_WIDTH", min: 1, max: NUMBER_SEQ_MAX_WIDTH }],
    ["INV-{SEQ:4", { code: "UNMATCHED_BRACE" }],
    ["INV}-{SEQ:4}", { code: "UNMATCHED_BRACE" }],
    ["INV-{{SEQ:4}}", { code: "UNMATCHED_BRACE" }],
    ["INV-{YYYY}", { code: "NO_SEQ" }],
    ["{SEQ:2}-{SEQ:4}", { code: "MULTIPLE_SEQ" }],
    ["", { code: "EMPTY" }],
    ["INV\u202E-{SEQ:4}", { code: "INVALID_CHARACTER" }],
    ["INV\n{SEQ:4}", { code: "INVALID_CHARACTER" }],
    [`${"X".repeat(NUMBER_PATTERN_MAX_LENGTH - 6)}{SEQ:4}`, { code: "TOO_LONG", max: NUMBER_PATTERN_MAX_LENGTH }],
  ])("refuses %j with a typed error", (source, error) => {
    expect(parsePattern(source)).toEqual({ ok: false, error });
  });

  it("accepts a pattern of exactly the maximum length", () => {
    expect(parsePattern(`${"X".repeat(NUMBER_PATTERN_MAX_LENGTH - 7)}{SEQ:4}`).ok).toBe(true);
  });
});

describe("checkResetRule", () => {
  it.each([
    ["INV-{SEQ:4}", "never", null],
    ["INV-{YYYY}-{SEQ:4}", "yearly", null],
    ["INV-{YY}-{SEQ:4}", "yearly", null],
    ["INV-{SEQ:4}", "yearly", { code: "PERIOD_MISSING", resetRule: "yearly" }],
    ["INV-{MM}-{SEQ:4}", "yearly", { code: "PERIOD_MISSING", resetRule: "yearly" }],
    ["INV-{YYYY}{MM}-{SEQ:4}", "monthly", null],
    ["INV-{YYYY}-{SEQ:4}", "monthly", { code: "PERIOD_MISSING", resetRule: "monthly" }],
    ["INV-{MM}-{SEQ:4}", "monthly", { code: "PERIOD_MISSING", resetRule: "monthly" }],
  ] as const)("%s under %s", (source, rule, expected) => {
    expect(checkResetRule(parsed(source), rule)).toEqual(expected);
  });

  it("parsePatternFor runs both checks", () => {
    expect(parsePatternFor("INV-{SEQ:4}", "yearly")).toEqual({ ok: false, error: { code: "PERIOD_MISSING", resetRule: "yearly" } });
    expect(parsePatternFor("{X}", "never")).toEqual({ ok: false, error: { code: "UNKNOWN_TOKEN", token: "{X}" } });
    expect(parsePatternFor("INV-{CODE}-{YYYY}-{SEQ:4}", "yearly").ok).toBe(true);
  });
});
