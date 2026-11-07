// A tax rate typed as a percentage (up to 5 whole digits and 2 decimals, never negative) and stored in basis points,
// by string arithmetic only (no floats). The digit bound keeps the value inside the integer column; the spec
// sets no upper bound on the rate itself.
const PERCENT = /^(\d{1,5})(?:\.(\d{1,2}))?$/;

export function percentToBps(text: string): number | null {
  const match = PERCENT.exec(text.trim());
  if (!match) return null;
  const [, whole = "0", fraction = ""] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0").replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${whole}.${fraction}`;
}
