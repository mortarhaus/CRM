export const INVITATION_EXPIRY_SECONDS = 30 * 60;

// Owner decision 2026-10-14 (NIST SP 800-63B-4 §3.1.1.2): counted in Unicode code points.
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export const NAME_MAX_LENGTH = 100;
export const WORKSPACE_NAME_MAX_LENGTH = 80;

// Not in the spec (plan ASK 4). Charlie decided 24 hours on 2026-10-26 (plan ASK 4).
export const IDEMPOTENCY_KEY_EXPIRY_SECONDS = 24 * 60 * 60;
// Plan Task 14 Step 1: a key is 1 to 128 characters (CHECK on idempotency_key.key).
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

// Spec "Authentication and sessions" → "Rate limits" → "Numbers" (revision 7, owner-approved 2026-10-20). Each is a
// fixed window. Only the Phase 1 rows are here; the reset, link and OTP rows land with their features (UNI-02).
export interface RateLimit {
  readonly windowSeconds: number;
  readonly max: number;
}

export const AUTH_DEFAULT_LIMIT: RateLimit = { windowSeconds: 60, max: 100 };
export const SIGN_IN_IP_LIMIT: RateLimit = { windowSeconds: 60, max: 10 };
export const SIGN_IN_ACCOUNT_FAILURE_LIMIT: RateLimit = { windowSeconds: 15 * 60, max: 5 };
export const SIGN_UP_IP_LIMIT: RateLimit = { windowSeconds: 60 * 60, max: 10 };
export const TWO_FACTOR_VERIFY_IP_LIMIT: RateLimit = { windowSeconds: 60, max: 10 };
export const PASSWORD_CHECK_IP_LIMIT: RateLimit = { windowSeconds: 15 * 60, max: 10 };
// The daily cleanup removes counter rows whose window ended more than this long ago.
export const RATE_LIMIT_ROW_RETENTION_SECONDS = 24 * 60 * 60;

// Not spec rows (builder proposal, review P2-1, DECISIONS 2026-11-01): the settings test email goes to the user's own
// address, which sign-up does not verify, so it is capped per user and per workspace.
export const TEST_EMAIL_USER_LIMIT: RateLimit = { windowSeconds: 60 * 60, max: 5 };
export const TEST_EMAIL_WORKSPACE_LIMIT: RateLimit = { windowSeconds: 60 * 60, max: 20 };

// workspace_settings (Phase 2 PR 2a, DECISIONS 2026-11-04). The short code is 2 to 6 uppercase letters or digits
// (Phase 2 plan Q21, settled by Charlie 2026-11-04). The text bounds are builder proposals pending Charlie: they bound
// storage and input (UNI-03), they are not business rules. EMAIL_ADDRESS_MAX_LENGTH is the RFC 5321 path limit.
// Each is enforced by Zod and by a char_length CHECK, both in code points.
export const SHORT_CODE_MIN_LENGTH = 2;
export const SHORT_CODE_MAX_LENGTH = 6;
export const ADDRESS_LINE_MAX_LENGTH = 200;
export const SETTINGS_TEXT_MAX_LENGTH = 100;
export const EMAIL_ADDRESS_MAX_LENGTH = 254;

// A code point, not a UTF-16 unit: an emoji counts once, like NIST and unlike String#length.
export function characterCount(value: string): number {
  return [...value].length;
}

// Uploads (Phase 2 plan Q12; FILE-02). The logo is at most 2 MB (2 * 1024 * 1024 bytes), PNG or JPG only, checked by
// magic bytes (Charlie, 2026-11-11; DECISIONS 2026-11-11).
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
