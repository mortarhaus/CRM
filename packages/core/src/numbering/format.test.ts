import { describe, expect, it } from "vitest";
import { formatNumber, MissingCodeError, periodKey } from "./format";
import { parsePattern } from "./pattern";
import { nextSequence, PeriodBehindError, withResetRule } from "./sequence";

const pattern = (source: string) => {
  const result = parsePattern(source);
  if (!result.ok) throw new Error("refused");
  return result.pattern;
};

const KL = "Asia/Kuala_Lumpur";
// 31 Dec 2026 23:30 UTC is 1 Jan 2027 07:30 in Kuala Lumpur (UTC+8).
const NEW_YEAR_IN_KL = new Date("2026-12-31T23:30:00Z");

describe("formatNumber", () => {
  it("uses the workspace time zone for {YYYY}, {YY} and {MM} (REC-08)", () => {
    const p = pattern("INV-{CODE}-{YYYY}-{YY}{MM}-{SEQ:4}");
    expect(formatNumber(p, { code: "ACME", seq: 1, at: NEW_YEAR_IN_KL, timeZone: KL })).toBe("INV-ACME-2027-2701-0001");
    expect(formatNumber(p, { code: "ACME", seq: 1, at: NEW_YEAR_IN_KL, timeZone: "UTC" })).toBe("INV-ACME-2026-2612-0001");
    // West of UTC the other way: 1 Jan 2027 03:00 UTC is still 2026 in New York.
    expect(formatNumber(p, { code: "A1", seq: 7, at: new Date("2027-01-01T03:00:00Z"), timeZone: "America/New_York" })).toBe(
      "INV-A1-2026-2612-0007",
    );
  });

  it("pads {SEQ:n} to n digits and prints a longer counter whole", () => {
    const at = new Date("2026-06-01T00:00:00Z");
    expect(formatNumber(pattern("{SEQ:4}"), { code: null, seq: 42, at, timeZone: KL })).toBe("0042");
    expect(formatNumber(pattern("{SEQ:1}"), { code: null, seq: 42, at, timeZone: KL })).toBe("42");
    expect(formatNumber(pattern("{SEQ:4}"), { code: null, seq: 12345, at, timeZone: KL })).toBe("12345");
  });

  it("refuses {CODE} without a short code, and a counter below 1", () => {
    const at = new Date();
    expect(() => formatNumber(pattern("{CODE}-{SEQ:4}"), { code: null, seq: 1, at, timeZone: KL })).toThrow(MissingCodeError);
    expect(() => formatNumber(pattern("{SEQ:4}"), { code: null, seq: 0, at, timeZone: KL })).toThrow(RangeError);
  });
});

describe("periodKey", () => {
  it("reads the period in the workspace time zone", () => {
    expect(periodKey("yearly", NEW_YEAR_IN_KL, KL)).toBe("2027");
    expect(periodKey("yearly", NEW_YEAR_IN_KL, "UTC")).toBe("2026");
    expect(periodKey("monthly", NEW_YEAR_IN_KL, KL)).toBe("2027-01");
    expect(periodKey("monthly", new Date("2026-11-30T16:00:00Z"), KL)).toBe("2026-12");
    expect(periodKey("monthly", new Date("2026-11-30T15:59:59.999Z"), KL)).toBe("2026-11");
    expect(periodKey("never", NEW_YEAR_IN_KL, KL)).toBe(periodKey("never", new Date(0), "UTC"));
  });
});

describe("nextSequence and withResetRule", () => {
  const before = new Date("2026-12-31T15:59:59Z"); // 23:59:59 on 31 Dec in KL
  const after = new Date("2026-12-31T16:00:00Z"); // 00:00 on 1 Jan in KL

  it("continues inside a period and starts at 1 in the next one", () => {
    const state = { resetRule: "yearly" as const, counter: 41, lastResetPeriod: "2026" };
    expect(nextSequence(state, before, KL)).toEqual({ seq: 42, period: "2026" });
    expect(nextSequence(state, after, KL)).toEqual({ seq: 1, period: "2027" });
    expect(nextSequence({ resetRule: "never", counter: 0, lastResetPeriod: null }, after, KL).seq).toBe(1);
    expect(nextSequence({ resetRule: "never", counter: 9, lastResetPeriod: "never" }, after, KL).seq).toBe(10);
  });

  it("a rule change keeps the counter inside the current period, so no number repeats", () => {
    const monthly = { resetRule: "monthly" as const, counter: 7, lastResetPeriod: "2026-11" };
    const yearly = withResetRule(monthly, "yearly", new Date("2026-11-15T00:00:00Z"), KL);
    expect(yearly).toEqual({ resetRule: "yearly", counter: 7, lastResetPeriod: "2026" });
    expect(nextSequence(yearly, new Date("2026-11-15T01:00:00Z"), KL).seq).toBe(8);
    const never = withResetRule({ resetRule: "yearly", counter: 5, lastResetPeriod: "2026" }, "never", before, KL);
    expect(nextSequence(never, after, KL).seq).toBe(6);
  });

  it("a rule change applies a reset already due under the old rule", () => {
    const stale = { resetRule: "yearly" as const, counter: 5, lastResetPeriod: "2025" };
    expect(withResetRule(stale, "never", before, KL)).toEqual({ resetRule: "never", counter: 0, lastResetPeriod: null });
    expect(withResetRule(stale, "yearly", before, KL)).toBe(stale);
  });

  // Bob PR #72 R1 P1: an instant in a period earlier than the stored one never starts the counter again.
  it("refuses a yearly period earlier than the stored one (a time before the last number's)", () => {
    const state = { resetRule: "yearly" as const, counter: 7, lastResetPeriod: "2027" };
    expect(() => nextSequence(state, before, KL)).toThrow(PeriodBehindError);
    expect(() => nextSequence(state, before, KL)).toThrow(expect.objectContaining({ period: "2026", lastResetPeriod: "2027" }));
    expect(nextSequence(state, after, KL)).toEqual({ seq: 8, period: "2027" });
  });

  it("refuses the earlier period a time zone further west gives for the same instant", () => {
    // 1 Jan 2027 00:30 in KL is 31 Dec 2026 11:30 in New York.
    const instant = new Date("2026-12-31T16:30:00Z");
    const state = nextSequence({ resetRule: "yearly", counter: 0, lastResetPeriod: null }, instant, KL);
    expect(state).toEqual({ seq: 1, period: "2027" });
    expect(() => nextSequence({ resetRule: "yearly", counter: 1, lastResetPeriod: "2027" }, instant, "America/New_York")).toThrow(
      PeriodBehindError,
    );
  });

  it("refuses a monthly period earlier than the stored one, across a year too", () => {
    const state = { resetRule: "monthly" as const, counter: 3, lastResetPeriod: "2027-01" };
    expect(() => nextSequence(state, new Date("2026-12-15T00:00:00Z"), KL)).toThrow(PeriodBehindError);
    expect(() => nextSequence({ ...state, lastResetPeriod: "2026-11" }, new Date("2026-10-31T00:00:00Z"), KL)).toThrow(PeriodBehindError);
    expect(nextSequence({ ...state, lastResetPeriod: "2026-09" }, new Date("2026-10-31T00:00:00Z"), KL)).toEqual({ seq: 1, period: "2026-10" });
  });

  it("never: one constant period, so no instant is behind", () => {
    const state = { resetRule: "never" as const, counter: 9, lastResetPeriod: "never" };
    expect(nextSequence(state, new Date("1990-01-01T00:00:00Z"), KL).seq).toBe(10);
  });

  it("a stored period of another rule's shape is an error, not a reset", () => {
    expect(() => nextSequence({ resetRule: "yearly", counter: 3, lastResetPeriod: "2026-11" }, before, KL)).toThrow(/does not fit/);
    expect(() => nextSequence({ resetRule: "never", counter: 3, lastResetPeriod: "2026" }, before, KL)).toThrow(/does not fit/);
  });

  it("a rule change at an instant before the stored period is refused, not a reset", () => {
    const yearly = { resetRule: "yearly" as const, counter: 4, lastResetPeriod: "2027" };
    expect(() => withResetRule(yearly, "monthly", before, KL)).toThrow(PeriodBehindError);
    expect(() => withResetRule(yearly, "never", before, KL)).toThrow(PeriodBehindError);
    const monthly = { resetRule: "monthly" as const, counter: 2, lastResetPeriod: "2027-01" };
    expect(() => withResetRule(monthly, "yearly", before, KL)).toThrow(PeriodBehindError);
    // The same rule changes nothing, so nothing is refused here; the next number is (nextSequence).
    expect(withResetRule(yearly, "yearly", before, KL)).toBe(yearly);
  });
});
