"use server";

import { randomUUID } from "node:crypto";
import { toWorkspaceSlug } from "@crm/core/workspace";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { postToAuth } from "@/lib/auth/forward";
import {
  limitMessage,
  TOO_MANY_ATTEMPTS,
  WORKSPACE_CREATE_FAILED,
  WORKSPACE_NAME_REQUIRED,
} from "@/lib/auth/messages";
import { getCurrentSession } from "@/lib/auth/session";
import { EMPTY_FORM_STATE, textField, type FormState } from "@/lib/forms";

export async function createWorkspaceAction(_previous: FormState, form: FormData): Promise<FormState> {
  // The page's layout guard is not a boundary for a posted action (AUTH-02).
  if (!(await getCurrentSession())) redirect("/sign-in");
  const name = textField(form, "name").trim();
  if (!name) return { error: WORKSPACE_NAME_REQUIRED, fields: { name } };

  const result = await postToAuth("/organization/create", { name, slug: toWorkspaceSlug(name, randomUUID().slice(0, 8)) });
  if (!result.ok) {
    const error = result.status === 429 ? TOO_MANY_ATTEMPTS : (limitMessage(result.code) ?? WORKSPACE_CREATE_FAILED);
    return { error, fields: { name } };
  }
  refresh();
  return EMPTY_FORM_STATE;
}
