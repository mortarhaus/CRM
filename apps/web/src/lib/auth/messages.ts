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
export const SIGN_IN_FAILED = "Email or password is incorrect.";
export const SIGN_UP_FAILED = "We couldn't create your account. Check your details and try again.";
export const WORKSPACE_NAME_REQUIRED = "Enter a workspace name.";
export const WORKSPACE_CREATE_FAILED = "We couldn't create that workspace. Try again.";

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
