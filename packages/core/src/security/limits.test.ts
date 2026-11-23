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
  SHORT_CODE_MAX_LENGTH,
  SHORT_CODE_MIN_LENGTH,
  SIGN_IN_ACCOUNT_FAILURE_LIMIT,
  SIGN_IN_IP_LIMIT,
  SIGN_UP_IP_LIMIT,
  STEP_UP_CODE_REUSE_SECONDS,
  STEP_UP_VERIFY_USER_FAILURE_LIMIT,
  STEP_UP_WINDOW_SECONDS,
  TEST_EMAIL_USER_LIMIT,
  TEST_EMAIL_WORKSPACE_LIMIT,
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

  it("keeps the short code at 2 to 6 characters (Phase 2 plan Q21, Charlie 2026-11-04)", () => {
    expect([SHORT_CODE_MIN_LENGTH, SHORT_CODE_MAX_LENGTH]).toEqual([2, 6]);
  });

  it("keeps step-up at the spec's 5 minutes, per-user failures at 5 per 15 minutes (Charlie 2026-11-22), and code reuse past 90 s", () => {
    expect(STEP_UP_WINDOW_SECONDS).toBe(300);
    expect(STEP_UP_VERIFY_USER_FAILURE_LIMIT).toEqual({ windowSeconds: 900, max: 5 });
    expect(STEP_UP_CODE_REUSE_SECONDS).toBeGreaterThan(3 * 30);
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

  it("not a spec row (review P2-1): the test email, 5 per hour per user and 20 per hour per workspace", () => {
    expect(TEST_EMAIL_USER_LIMIT).toEqual({ windowSeconds: 3600, max: 5 });
    expect(TEST_EMAIL_WORKSPACE_LIMIT).toEqual({ windowSeconds: 3600, max: 20 });
  });
});

describe("characterCount", () => {
  it("counts code points, so a character outside the BMP counts once", () => {
    expect(characterCount("abc")).toBe(3);
    expect(characterCount("🔑🔑")).toBe(2);
    expect("🔑🔑".length).toBe(4);
  });
});
