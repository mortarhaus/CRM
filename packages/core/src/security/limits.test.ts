import { describe, expect, it } from "vitest";
import {
  characterCount,
  IDEMPOTENCY_KEY_EXPIRY_SECONDS,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  INVITATION_EXPIRY_SECONDS,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "./limits";

describe("fixed security values", () => {
  it("keeps the invitation expiry at the spec's 30 minutes", () => {
    expect(INVITATION_EXPIRY_SECONDS).toBe(1800);
  });

  it("keeps the owner's password and name limits (DECISIONS 2026-10-14)", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(15);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(NAME_MAX_LENGTH).toBe(100);
    expect(WORKSPACE_NAME_MAX_LENGTH).toBe(80);
  });

  it("keeps the idempotency key expiry at the decided 24 hours (ASK 4, Charlie 2026-10-26) and keys at 128", () => {
    expect(IDEMPOTENCY_KEY_EXPIRY_SECONDS).toBe(86_400);
    expect(IDEMPOTENCY_KEY_MAX_LENGTH).toBe(128);
  });
});

describe("characterCount", () => {
  it("counts code points, so a character outside the BMP counts once", () => {
    expect(characterCount("abc")).toBe(3);
    expect(characterCount("🔑🔑")).toBe(2);
    expect("🔑🔑".length).toBe(4);
  });
});
