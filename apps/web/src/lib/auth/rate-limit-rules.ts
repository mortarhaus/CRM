import {
  AUTH_DEFAULT_LIMIT,
  PASSWORD_CHECK_IP_LIMIT,
  type RateLimit,
  SIGN_IN_IP_LIMIT,
  SIGN_UP_IP_LIMIT,
  TWO_FACTOR_VERIFY_IP_LIMIT,
} from "@crm/core/security";
import type { BetterAuthOptions } from "better-auth";
import { consume } from "../../db/system";

// The limiter pool, typed through the system module (TEN-10: no db/client import here).
type Database = Parameters<typeof consume>[0];

// Spec "Rate limits" → "Numbers": the Phase 1 rows Better Auth's limiter enforces, each keyed by IP (plan Task 23).
// Better Auth 1.7.14 hands its storage the key `<ip>|<path>`, one counter per path. A spec row that covers several
// paths (2FA verify: two; password check: five; the default row: every other path) is one counter per IP, so the
// storage below keys by row, not by path: `ba:<row>:<ip>`.
export type RateLimitRow = "default" | "sign-in" | "sign-up" | "two-factor-verify" | "password-check";

export const RATE_LIMIT_ROWS: Readonly<Record<RateLimitRow, RateLimit>> = {
  default: AUTH_DEFAULT_LIMIT,
  "sign-in": SIGN_IN_IP_LIMIT,
  "sign-up": SIGN_UP_IP_LIMIT,
  "two-factor-verify": TWO_FACTOR_VERIFY_IP_LIMIT,
  "password-check": PASSWORD_CHECK_IP_LIMIT,
};

// Every enabled Phase 1 path whose body carries a password field (`password` or `currentPassword`), read from the
// installed 1.7.14 endpoint body schemas. Sign-in has its own row. Reset arrives with the reset feature, and
// /two-factor/get-totp-uri is not enabled (no page calls it; enabled-paths.ts).
export const PASSWORD_CHECK_PATHS = [
  "/change-password",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/generate-backup-codes",
] as const;

const NAMED_PATHS: Readonly<Record<string, RateLimitRow>> = {
  "/sign-in/email": "sign-in",
  "/sign-up/email": "sign-up",
  "/two-factor/verify-totp": "two-factor-verify",
  "/two-factor/verify-backup-code": "two-factor-verify",
  ...Object.fromEntries(PASSWORD_CHECK_PATHS.map((path) => [path, "password-check"])),
};

export function rateLimitRowOf(path: string): RateLimitRow {
  return NAMED_PATHS[path] ?? "default";
}

// Splits Better Auth's `<ip>|<path>` key (an IP never holds `|`) into the row's key and limit.
export function rowKeyOf(betterAuthKey: string): { key: string; row: RateLimitRow; limit: RateLimit } {
  const separator = betterAuthKey.indexOf("|");
  const ip = separator === -1 ? betterAuthKey : betterAuthKey.slice(0, separator);
  const path = separator === -1 ? "" : betterAuthKey.slice(separator + 1);
  const row = rateLimitRowOf(path);
  return { key: `ba:${row}:${ip}`, row, limit: RATE_LIMIT_ROWS[row] };
}

function rule({ windowSeconds, max }: RateLimit) {
  return { window: windowSeconds, max };
}

// Better Auth's own rules for these paths are overridden so its view matches the storage's: the built-in 3 per 10 s
// on /sign-in*, /sign-up*, /change-password and the twoFactor plugin's 3 per 10 s on /two-factor/*. The storage
// decides from the row table either way; a path missing here would only change the window Better Auth reports
// when the storage gives no retry time, which it always does.
const CUSTOM_RULES = Object.fromEntries(
  Object.entries(NAMED_PATHS).map(([path, row]) => [path, rule(RATE_LIMIT_ROWS[row])]),
);

// `db` is the limiter's own pool (createAuth; Charlie 2026-11-01, decision 1 A): each consume autocommits, so the
// counter row is never held for a whole request, and a granted unit stays counted even if the request later fails.
// `enabled: true` turns the limits on in dev and tests too (spec: tests run with them on).
export function rateLimitOptions(db: Database): NonNullable<BetterAuthOptions["rateLimit"]> {
  return {
    enabled: true,
    window: AUTH_DEFAULT_LIMIT.windowSeconds,
    max: AUTH_DEFAULT_LIMIT.max,
    customRules: CUSTOM_RULES,
    customStorage: {
      async consume(betterAuthKey) {
        const { key, limit } = rowKeyOf(betterAuthKey);
        const result = await consume(db, key, limit.max, limit.windowSeconds, null);
        return result.allowed
          ? { allowed: true, retryAfter: null }
          : { allowed: false, retryAfter: result.retryAfterSeconds };
      },
    },
  };
}
