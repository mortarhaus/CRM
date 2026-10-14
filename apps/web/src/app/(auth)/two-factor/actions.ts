"use server";

import { redirect } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import { TOO_MANY_ATTEMPTS, WRONG_CODE, WRONG_RECOVERY_CODE } from "@/lib/auth/messages";
import { EMPTY_FORM_STATE, textField, type FormState } from "@/lib/forms";

const METHODS = {
  totp: { path: "/two-factor/verify-totp", extra: { trustDevice: false }, wrong: WRONG_CODE },
  recovery: { path: "/two-factor/verify-backup-code", extra: {}, wrong: WRONG_RECOVERY_CODE },
} as const;

// The code travels only in the POST body; the page URL stays /two-factor.
export async function verifyTwoFactorAction(_previous: FormState, form: FormData): Promise<FormState> {
  const methodName = textField(form, "method");
  if (methodName !== "totp" && methodName !== "recovery") return { ...EMPTY_FORM_STATE, error: WRONG_CODE };
  const method = METHODS[methodName];
  const result = await postToAuth(method.path, { code: textField(form, "code").trim(), ...method.extra });
  if (!result.ok) return { ...EMPTY_FORM_STATE, error: result.status === 429 ? TOO_MANY_ATTEMPTS : method.wrong };
  redirect("/workspaces");
}
