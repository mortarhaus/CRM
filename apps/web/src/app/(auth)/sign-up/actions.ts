"use server";

import { redirect } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import { limitMessage, SIGN_UP_FAILED, TOO_MANY_ATTEMPTS } from "@/lib/auth/messages";
import { textField, type FormState } from "@/lib/forms";

export async function signUpAction(_previous: FormState, form: FormData): Promise<FormState> {
  const name = textField(form, "name");
  const email = textField(form, "email");
  const result = await postToAuth("/sign-up/email", { name, email, password: textField(form, "password") });
  if (!result.ok) {
    // A new and an existing email both succeed (autoSignIn off), so no failure here depends on the account.
    const error = result.status === 429 ? TOO_MANY_ATTEMPTS : (limitMessage(result.code) ?? SIGN_UP_FAILED);
    return { error, fields: { name, email } };
  }
  redirect("/sign-in?registered=1");
}
