import { describe, expect, it } from "vitest";
import { withBillingAccountReference } from "./billing-account-reference";

const GENERATED = [
  'import { relations, sql } from "drizzle-orm";',
  'import { pgTable, text, uuid } from "drizzle-orm/pg-core";',
  "",
  'export const organization = pgTable("organization", {',
  '  billingAccountId: text("billing_account_id"),',
  "});",
].join("\n");

describe("withBillingAccountReference", () => {
  it("turns the generated text column into a uuid foreign key to billing_account", () => {
    expect(withBillingAccountReference(GENERATED)).toBe(
      [
        'import { relations, sql } from "drizzle-orm";',
        'import { pgTable, text, uuid } from "drizzle-orm/pg-core";',
        'import { billingAccount } from "./system";',
        "",
        'export const organization = pgTable("organization", {',
        '  billingAccountId: uuid("billing_account_id").references(() => billingAccount.id, { onDelete: "restrict" }),',
        "});",
      ].join("\n"),
    );
  });

  it("is idempotent", () => {
    const once = withBillingAccountReference(GENERATED);
    expect(withBillingAccountReference(once)).toBe(once);
  });

  it("fails loudly when the generator output no longer has the column", () => {
    expect(() => withBillingAccountReference(GENERATED.replace("billingAccountId", "billingId"))).toThrow(
      /billing_account_id/,
    );
  });
});
