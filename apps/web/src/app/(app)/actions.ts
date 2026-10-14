"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import { SIGN_OUT_FAILED, TOO_MANY_ATTEMPTS, WORKSPACE_SWITCH_FAILED } from "@/lib/auth/messages";
import { getCurrentSession } from "@/lib/auth/session";
import { EMPTY_FORM_STATE, textField, type FormState } from "@/lib/forms";

// Workspace ids are database uuids; Better Auth passes the value straight to a uuid column.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setActiveWorkspaceAction(_previous: FormState, form: FormData): Promise<FormState> {
  // The layout's guard is not a boundary for a posted action (AUTH-02).
  if (!(await getCurrentSession())) redirect("/sign-in");
  const organizationId = textField(form, "organizationId");
  if (!UUID.test(organizationId)) return { ...EMPTY_FORM_STATE, error: WORKSPACE_SWITCH_FAILED };

  const result = await postToAuth("/organization/set-active", { organizationId });
  // Better Auth refuses a workspace the user is not a member of, and then clears the active workspace
  // (organization plugin 1.7.6), so the page is refreshed after a refusal too.
  refresh();
  if (!result.ok) {
    return { ...EMPTY_FORM_STATE, error: result.status === 429 ? TOO_MANY_ATTEMPTS : WORKSPACE_SWITCH_FAILED };
  }
  return EMPTY_FORM_STATE;
}

// Navigates only after Better Auth confirms the sign-out; a refusal keeps the user on the page (AUTH-13).
// It reads nothing from the form, so it takes no arguments; useActionState may pass them anyway.
export async function signOutAction(): Promise<FormState> {
  if (!(await getCurrentSession())) redirect("/sign-in");
  const result = await postToAuth("/sign-out", {});
  if (!result.ok) return { ...EMPTY_FORM_STATE, error: SIGN_OUT_FAILED };
  redirect("/sign-in");
}
