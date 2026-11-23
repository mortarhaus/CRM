import { describe, expect, it } from "vitest";
import { DATE_FORMAT_EXAMPLES, DATE_FORMATS } from "./country-defaults";
import { formatDateTime } from "./date-time";

// 2026-11-07T17:05:00Z is 08-Nov-2026 01:05 in Kuala Lumpur (UTC+8): the date is the workspace's, not UTC's.
const INSTANT = new Date("2026-11-07T17:05:00Z");

describe("formatDateTime", () => {
  it.each(DATE_FORMATS)("writes the date as %s shows it, then the 24-hour time and the zone", (format) => {
    expect(formatDateTime(INSTANT, "Asia/Kuala_Lumpur", format)).toBe(`${DATE_FORMAT_EXAMPLES[format]} 01:05 (Asia/Kuala_Lumpur)`);
  });

  it("uses the workspace time zone", () => {
    expect(formatDateTime(INSTANT, "UTC", "dd-mmm-yyyy")).toBe("07-Nov-2026 17:05 (UTC)");
    expect(formatDateTime(new Date("2026-01-31T23:59:00Z"), "Asia/Singapore", "dd-mmm-yyyy")).toBe("01-Feb-2026 07:59 (Asia/Singapore)");
  });

  it("writes midnight as 00, not 24", () => {
    expect(formatDateTime(new Date("2026-03-01T16:00:00Z"), "Asia/Kuala_Lumpur", "yyyy-mm-dd")).toBe("2026-03-02 00:00 (Asia/Kuala_Lumpur)");
  });
});
