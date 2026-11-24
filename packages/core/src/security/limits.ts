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

// Step-up (spec "Authorization": a fresh TOTP within the last 5 minutes for high-risk actions; Phase 2 plan Task 13).
export const STEP_UP_WINDOW_SECONDS = 5 * 60;
// Step-up code checks per user, failures only (Charlie 2026-11-22, Bob PR #68 P2; DECISIONS 2026-11-22): the sign-in
// account cap's numbers, so a held session cannot spread guesses over many IP addresses; an accepted code gives its
// unit back.
export const STEP_UP_VERIFY_USER_FAILURE_LIMIT: RateLimit = { windowSeconds: 15 * 60, max: 5 };
// A code accepted for step-up is refused again for this long, for every session of the user. Better Auth 1.7.14 checks
// a TOTP of 30 s steps with a window of one step either side (@better-auth/utils otp verifyTOTP), so one code is valid
// for at most 3 steps (90 s); one more step covers clock skew between the app and the database.
export const STEP_UP_CODE_REUSE_SECONDS = 4 * 30;

// Document numbering patterns (Phase 2 plan Task 17; spec "Numbering"). Confirmed by Charlie on 2026-11-24 (DECISIONS
// 2026-11-24): they bound input (UNI-03), they are not business rules. A pattern is at most 50 code points; {SEQ:n} pads to n digits, 1 to 9
// (a counter is a Postgres integer, at most 10 digits; a longer counter prints all its digits, never a cut number).
export const NUMBER_PATTERN_MAX_LENGTH = 50;
export const NUMBER_SEQ_MAX_WIDTH = 9;

// Uploads (Phase 2 plan Q12; FILE-02). The logo is at most 2 MB (2 * 1024 * 1024 bytes), PNG or JPG only, checked by
// magic bytes (Charlie, 2026-11-11; DECISIONS 2026-11-11).
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
// The payment QR (DuitNow/PayNow), PNG or JPG by magic bytes. Builder proposal pending Charlie (PR 5b ASK): the logo's
// limit, which any phone screenshot of a bank's QR fits.
export const PAYMENT_QR_MAX_BYTES = LOGO_MAX_BYTES;
