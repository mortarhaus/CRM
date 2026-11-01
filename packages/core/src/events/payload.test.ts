import { describe, expect, it } from "vitest";
import { minorUnits, parseMinorUnits } from "./payload";

describe("minorUnits (money across the event boundary, MON-03)", () => {
  it("encodes an amount as its canonical decimal string", () => {
    expect(minorUnits(0n)).toBe("0");
    expect(minorUnits(9007199254740993n)).toBe("9007199254740993");
  });

  it("refuses a negative amount (spec Money rules)", () => {
    expect(() => minorUnits(-1n)).toThrow(RangeError);
  });
});

describe("parseMinorUnits", () => {
  it("round-trips the largest bigint amount exactly", () => {
    const amount = 2n ** 63n - 1n;
    expect(parseMinorUnits(minorUnits(amount))).toBe(amount);
  });

  it.each(["", "01", "1e3", " 1", "-1", "1.5", "0x10"])("refuses %j", (value) => {
    expect(() => parseMinorUnits(value)).toThrow();
  });
});
