import { describe, expect, it } from "vitest";
import { bpsToPercent, percentToBps } from "./tax-rate";

// The onboarding tax rate is typed as a percentage and stored in basis points (spec Money rules "Representation"),
// with string arithmetic only (no floats).
describe("percentToBps", () => {
  it.each([
    ["8", 800],
    ["9", 900],
    ["0", 0],
    ["6.5", 650],
    ["0.25", 25],
    [" 10.00 ", 1000],
    ["150", 15000],
    ["99999.99", 9999999],
  ])("%j is %i bps", (text, bps) => expect(percentToBps(text)).toBe(bps));

  it.each(["", "-1", "8%", "8.123", "1e2", "0x10", ".5", "8.", "100000", "８"])("refuses %j", (text) => {
    expect(percentToBps(text)).toBeNull();
  });
});

describe("bpsToPercent", () => {
  it.each([
    [800, "8"],
    [900, "9"],
    [0, "0"],
    [650, "6.5"],
    [25, "0.25"],
    [9999999, "99999.99"],
  ])("%i bps is %j", (bps, text) => expect(bpsToPercent(bps)).toBe(text));

  it("round-trips with percentToBps", () => {
    for (const bps of [0, 1, 10, 99, 800, 875, 12345]) expect(percentToBps(bpsToPercent(bps))).toBe(bps);
  });
});
