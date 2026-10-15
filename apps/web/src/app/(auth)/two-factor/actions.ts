"use server";

import { redirect } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import { TOO_MANY_ATTEMPTS, WRONG_CODE, WRONG_RECOVERY_CODE } from "@/lib/auth/messages";
import { EMPTY_FORM_STATE, textField, type FormState } from "@/lib/forms";

const METHODS = {
  totp: { path: "/two-factor/verify-totp", extra: { trustDevice: false }, wrong: WRONG_CODE },
  recovery: { path: "/two-factor/verify-backup-code", extra: {}, wrong: WRONG_RECOVERY_CODE },
} as const;

// Better Auth 1.7.6 codes for a challenge that can no longer be used: the two-factor cookie is missing,
// expired or already consumed, or the challenge's attempts ran out (the library then deletes it).
// Only a fresh sign-in starts a new challenge, so these go back to sign-in instead of the wrong-code text.
const CHALLENGE_ENDED = new Set(["INVALID_TWO_FACTOR_COOKIE", "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"]);

// The code travels only in the POST body; the page URL stays /two-factor.
export async function verifyTwoFactorAction(_previous: FormState, form: FormData): Promise<FormState> {
  const methodName = textField(form, "method");
  if (methodName !== "totp" && methodName !== "recovery") return { ...EMPTY_FORM_STATE, error: WRONG_CODE };
  const method = METHODS[methodName];
  const result = await postToAuth(method.path, { code: textField(form, "code").trim(), ...method.extra });
  if (!result.ok && result.code !== undefined && CHALLENGE_ENDED.has(result.code)) redirect("/sign-in?expired=1");
  if (!result.ok) return { ...EMPTY_FORM_STATE, error: result.status === 429 ? TOO_MANY_ATTEMPTS : method.wrong };
  redirect("/workspaces");
}
