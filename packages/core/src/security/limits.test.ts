import { describe, expect, it } from "vitest";
import {
  AUTH_DEFAULT_LIMIT,
  characterCount,
  IDEMPOTENCY_KEY_EXPIRY_SECONDS,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  INVITATION_EXPIRY_SECONDS,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_CHECK_IP_LIMIT,
  PASSWORD_MIN_LENGTH,
  RATE_LIMIT_ROW_RETENTION_SECONDS,
  SIGN_IN_ACCOUNT_FAILURE_LIMIT,
  SIGN_IN_IP_LIMIT,
  SIGN_UP_IP_LIMIT,
  TWO_FACTOR_VERIFY_IP_LIMIT,
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

describe("rate limits (spec Authentication and sessions, Rate limits, Numbers)", () => {
  it("spec Rate limits, Numbers row 1: any other /api/auth path, 100 per 60 s per IP", () => {
    expect(AUTH_DEFAULT_LIMIT).toEqual({ windowSeconds: 60, max: 100 });
  });

  it("spec Rate limits, Numbers row 2: sign-in, 10 per 60 s per IP", () => {
    expect(SIGN_IN_IP_LIMIT).toEqual({ windowSeconds: 60, max: 10 });
  });

  it("spec Rate limits, Numbers row 3: sign-in, 5 failures per 15 min per account", () => {
    expect(SIGN_IN_ACCOUNT_FAILURE_LIMIT).toEqual({ windowSeconds: 900, max: 5 });
  });

  it("spec Rate limits, Numbers row 4: sign-up, 10 per 60 min per IP", () => {
    expect(SIGN_UP_IP_LIMIT).toEqual({ windowSeconds: 3600, max: 10 });
  });

  it("spec Rate limits, Numbers row 5: 2FA verify, 10 per 60 s per IP", () => {
    expect(TWO_FACTOR_VERIFY_IP_LIMIT).toEqual({ windowSeconds: 60, max: 10 });
  });

  it("spec Rate limits, Numbers row 8: every endpoint that checks a password, 10 per 15 min per IP", () => {
    expect(PASSWORD_CHECK_IP_LIMIT).toEqual({ windowSeconds: 900, max: 10 });
  });

  it("spec Rate limits, Storage and keys: cleanup removes rows whose window ended more than 24 hours ago", () => {
    expect(RATE_LIMIT_ROW_RETENTION_SECONDS).toBe(86_400);
  });
});

describe("characterCount", () => {
  it("counts code points, so a character outside the BMP counts once", () => {
    expect(characterCount("abc")).toBe(3);
    expect(characterCount("🔑🔑")).toBe(2);
    expect("🔑🔑".length).toBe(4);
  });
});
