"use server";

import { redirect, RedirectType } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import { TOO_MANY_ATTEMPTS, TWO_FACTOR_PASSWORD_WRONG, WRONG_CODE } from "@/lib/auth/messages";
import { getCurrentSession } from "@/lib/auth/session";
import { textField, type FormState } from "@/lib/forms";

export interface Enrolment {
  totpURI: string;
  setupKey: string;
  backupCodes: string[];
}

export interface TwoFactorSetupState extends FormState {
  enrolment: Enrolment | null;
}

function toEnrolment(totpURI: string, backupCodes: string[]): Enrolment | null {
  if (!totpURI.startsWith("otpauth://totp/") || !URL.canParse(totpURI) || backupCodes.length === 0) return null;
  return { totpURI, setupKey: new URL(totpURI).searchParams.get("secret") ?? "", backupCodes };
}

// The password travels only in the POST body; the page URL stays /settings/security.
export async function startTwoFactorAction(
  _previous: TwoFactorSetupState,
  form: FormData,
): Promise<TwoFactorSetupState> {
  // The page's guard is not a boundary for a posted action (AUTH-02).
  if (!(await getCurrentSession())) redirect("/sign-in");
  const result = await postToAuth("/two-factor/enable", { password: textField(form, "password") });
  const data = result.data;
  const enrolment =
    result.ok && typeof data === "object" && data !== null && "totpURI" in data && "backupCodes" in data
      ? toEnrolment(String(data.totpURI), Array.isArray(data.backupCodes) ? data.backupCodes.map(String) : [])
      : null;
  if (!enrolment) {
    const error = result.status === 429 ? TOO_MANY_ATTEMPTS : TWO_FACTOR_PASSWORD_WRONG;
    return { error, fields: {}, enrolment: null };
  }
  return { error: null, fields: {}, enrolment };
}

// The confirm form posts the setup link and recovery codes back with the code, so a refused code can show
// them again on a page rendered without JavaScript (Better Auth returns them only once). They are only
// displayed, never trusted: Better Auth checks the code against the secret it stored.
export async function confirmTwoFactorAction(
  _previous: TwoFactorSetupState,
  form: FormData,
): Promise<TwoFactorSetupState> {
  if (!(await getCurrentSession())) redirect("/sign-in");
  const result = await postToAuth("/two-factor/verify-totp", { code: textField(form, "code").trim() });
  if (!result.ok) {
    const backupCodes = form.getAll("backupCode").filter((code) => typeof code === "string");
    return {
      error: result.status === 429 ? TOO_MANY_ATTEMPTS : WRONG_CODE,
      fields: {},
      enrolment: toEnrolment(textField(form, "totpURI"), backupCodes),
    };
  }
  // Enrolment replaces the session; a fresh request renders the page with the new session cookie.
  redirect("/settings/security", RedirectType.replace);
}
