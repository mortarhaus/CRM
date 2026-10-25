import { describe, expect, it } from "vitest";
import { PII_REDACTED, redactPii } from "./redact";

describe("redactPii", () => {
  it("replaces every listed field and keeps the others", () => {
    expect(redactPii({ name: "A", email: "a@x", amount: 5 }, ["name", "email"])).toEqual({
      name: "[pii]",
      email: "[pii]",
      amount: 5,
    });
  });

  it("returns null for null", () => {
    expect(redactPii(null, ["email"])).toBeNull();
  });

  it("leaves a listed field that is absent absent", () => {
    const redacted = redactPii<Record<string, unknown>>({ amount: 5 }, ["email"]);
    expect(redacted).toEqual({ amount: 5 });
    expect(redacted).not.toHaveProperty("email");
  });

  it("redacts a listed field whose value is null or an object, and does not change the input", () => {
    const value = { email: null, address: { line1: "1 Jalan" }, amount: 5 };
    expect(redactPii(value, ["email", "address"])).toEqual({ email: PII_REDACTED, address: PII_REDACTED, amount: 5 });
    expect(value).toEqual({ email: null, address: { line1: "1 Jalan" }, amount: 5 });
  });
});
