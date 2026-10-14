"use server";

import { redirect } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import { SIGN_IN_FAILED, TOO_MANY_ATTEMPTS } from "@/lib/auth/messages";
import { textField, type FormState } from "@/lib/forms";

function needsSecondFactor(data: unknown): boolean {
  return typeof data === "object" && data !== null && "twoFactorRedirect" in data && data.twoFactorRedirect === true;
}

export async function signInAction(_previous: FormState, form: FormData): Promise<FormState> {
  const email = textField(form, "email");
  const result = await postToAuth("/sign-in/email", { email, password: textField(form, "password") });
  if (!result.ok) {
    return { error: result.status === 429 ? TOO_MANY_ATTEMPTS : SIGN_IN_FAILED, fields: { email } };
  }
  redirect(needsSecondFactor(result.data) ? "/two-factor" : "/workspaces");
}
