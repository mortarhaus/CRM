import { describe, expect, it } from "vitest";
import { toTimestamptz } from "./timestamptz";

describe("toTimestamptz", () => {
  it("adds withTimezone to every bare timestamp column", () => {
    const source = [
      'createdAt: timestamp("created_at").defaultNow().notNull(),',
      'expiresAt: timestamp("expires_at").notNull(),',
    ].join("\n");
    expect(toTimestamptz(source)).toBe(
      [
        'createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),',
        'expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),',
      ].join("\n"),
    );
  });

  it("leaves the pg-core import and non-timestamp columns alone", () => {
    const source = 'import { pgTable, text, timestamp } from "drizzle-orm/pg-core";\nname: text("name").notNull(),';
    expect(toTimestamptz(source)).toBe(source);
  });

  it("is idempotent", () => {
    const once = toTimestamptz('timestamp("created_at")');
    expect(toTimestamptz(once)).toBe(once);
  });
});
