import {
  AUTH_DEFAULT_LIMIT,
  PASSWORD_CHECK_IP_LIMIT,
  SIGN_IN_IP_LIMIT,
  SIGN_UP_IP_LIMIT,
  TWO_FACTOR_VERIFY_IP_LIMIT,
} from "@crm/core/security";
import { describe, expect, it } from "vitest";
import type { Database } from "../../db/client";
import { rateLimitOptions, rateLimitRowOf, rowKeyOf } from "./rate-limit-rules";

describe("the Better Auth limiter rows (spec 'Rate limits' → 'Numbers')", () => {
  it.each([
    ["/sign-in/email", "sign-in", SIGN_IN_IP_LIMIT],
    ["/sign-up/email", "sign-up", SIGN_UP_IP_LIMIT],
    ["/two-factor/verify-totp", "two-factor-verify", TWO_FACTOR_VERIFY_IP_LIMIT],
    ["/two-factor/verify-backup-code", "two-factor-verify", TWO_FACTOR_VERIFY_IP_LIMIT],
    ["/change-password", "password-check", PASSWORD_CHECK_IP_LIMIT],
    ["/two-factor/enable", "password-check", PASSWORD_CHECK_IP_LIMIT],
    ["/two-factor/disable", "password-check", PASSWORD_CHECK_IP_LIMIT],
    ["/two-factor/generate-backup-codes", "password-check", PASSWORD_CHECK_IP_LIMIT],
    ["/get-session", "default", AUTH_DEFAULT_LIMIT],
    ["/organization/create", "default", AUTH_DEFAULT_LIMIT],
  ])("%s counts on the %s row", (path, row, limit) => {
    expect(rateLimitRowOf(path)).toBe(row);
    expect(rowKeyOf(`203.0.113.9|${path}`)).toEqual({ key: `ba:${row}:203.0.113.9`, row, limit });
  });

  it("keys an IPv6 /64 and keeps the paths of one row on one counter", () => {
    const ip = "2001:0db8:0001:0002:0000:0000:0000:0000";
    expect(rowKeyOf(`${ip}|/two-factor/verify-totp`).key).toBe(`ba:two-factor-verify:${ip}`);
    expect(rowKeyOf(`${ip}|/two-factor/verify-backup-code`).key).toBe(`ba:two-factor-verify:${ip}`);
  });

  // Better Auth 1.7.14 applies 3 per 10 s to /sign-in*, /sign-up*, /change-password, /change-email and the
  // twoFactor plugin's /two-factor/* unless a custom rule names the path (api/rate-limiter/index.mjs).
  it("gives every named path a custom rule with its row's numbers, so none falls back to 3 per 10 s", () => {
    const options = rateLimitOptions({} as Database);
    const rules = options.customRules ?? {};
    for (const path of Object.keys(rules)) {
      const { limit } = rowKeyOf(`192.0.2.1|${path}`);
      expect(rules[path]).toEqual({ window: limit.windowSeconds, max: limit.max });
    }
    expect(Object.keys(rules).sort()).toEqual(
      [
        "/change-password",
        "/sign-in/email",
        "/sign-up/email",
        "/two-factor/disable",
        "/two-factor/enable",
        "/two-factor/generate-backup-codes",
        "/two-factor/verify-backup-code",
        "/two-factor/verify-totp",
      ].sort(),
    );
    expect(options).toMatchObject({ enabled: true, window: AUTH_DEFAULT_LIMIT.windowSeconds, max: AUTH_DEFAULT_LIMIT.max });
  });
});
