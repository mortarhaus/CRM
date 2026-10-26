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

// A code point, not a UTF-16 unit: an emoji counts once, like NIST and unlike String#length.
export function characterCount(value: string): number {
  return [...value].length;
}
