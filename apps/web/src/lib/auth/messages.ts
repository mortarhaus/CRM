import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@crm/core/security";
import type { LimitErrorCode } from "./input-limits";

export const TOO_MANY_ATTEMPTS = "Too many attempts. Wait a moment and try again.";
export const WRONG_CODE = "That code didn't work. Check your authenticator app and try again.";
export const WRONG_RECOVERY_CODE = "That recovery code didn't work. Check it and try again.";
export const TWO_FACTOR_EXPIRED = "Your sign-in expired or had too many tries. Sign in again to continue.";
export const SIGN_IN_FAILED = "Email or password is incorrect.";
export const SIGN_UP_FAILED = "We couldn't create your account. Check your details and try again.";
export const WORKSPACE_NAME_REQUIRED = "Enter a workspace name.";
export const WORKSPACE_CREATE_FAILED = "We couldn't create that workspace. Try again.";
export const WORKSPACE_SWITCH_FAILED = "Couldn't switch workspace. Try again.";
export const SIGN_OUT_FAILED = "We couldn't sign you out. Try again.";
export const TWO_FACTOR_PASSWORD_WRONG = "Your password didn't match. Try again.";

// /settings/email (Charlie, ASK 8 = A, 2026-11-01; the intro sentence is the builder's).
export const TEST_EMAIL_INTRO = "Send a test email to your own address to check that email delivery works.";
export const SEND_TEST_EMAIL = "Send a test email";
export const SENDING_TEST_EMAIL = "Sending…";
export const TEST_EMAIL_QUEUED = "Test email queued.";
export const TEST_EMAIL_FORBIDDEN = "Only an Admin or Owner can send a test email.";
export const TEST_EMAIL_FAILED = "We couldn't send the test email. Try again.";
export const TEST_EMAIL_RATE_LIMITED = "You sent several test emails already. Try again in an hour.";

// /settings/branding (plan Task 6; builder copy).
export const BRANDING_INTRO =
  "Your brand colour fills buttons and the selected menu item, and outlines the control in focus. Text on it is black or white, whichever reads better.";
export const BRANDING_HINT = "Enter # and six hex digits, for example #0e6c84, or pick a colour below.";
export const SAVE_BRANDING = "Save colour";
export const SAVING_BRANDING = "Saving…";
export const BRANDING_SAVED = "Brand colour saved.";
export const BRANDING_INVALID = "That isn't a colour we can use. Enter # and six hex digits, for example #0e6c84.";
export const BRANDING_STALE = "Someone else changed the branding after this page loaded. Reload the page, then save again.";
export const BRANDING_FORBIDDEN = "Only an Admin or Owner can change the branding.";
export const BRANDING_FAILED = "We couldn't save the colour. Try again.";

// Shown on every page when the browser lacks a feature the app relies on (Charlie via Bob, PR #53 R2; builder copy).
export const OUTDATED_BROWSER = "Your browser is out of date, so parts of CRM may not work properly. Please update your browser.";

// Keyed by the codes `input-limits.ts` refuses with; the text follows the shared limits.
const LIMIT_MESSAGES: Record<LimitErrorCode, string> = {
  PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`,
  PASSWORD_TOO_LONG: `Use at most ${PASSWORD_MAX_LENGTH} characters for your password.`,
  NAME_TOO_LONG: `Use at most ${NAME_MAX_LENGTH} characters for your name.`,
  WORKSPACE_NAME_TOO_LONG: `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters for the workspace name.`,
};

export function limitMessage(code: string | undefined): string | undefined {
  return code !== undefined && code in LIMIT_MESSAGES ? LIMIT_MESSAGES[code as LimitErrorCode] : undefined;
}
