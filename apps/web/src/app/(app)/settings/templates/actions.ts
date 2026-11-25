"use server";

import { EMAIL_TEMPLATE_BODY_MAX_LENGTH, EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH } from "@crm/core/security";
import { EMAIL_EVENTS, EMAIL_TEMPLATE_DEFAULTS, isEmailEvent, templateProblems } from "@crm/core/templates";
import { z } from "zod";
import { saveEmailTemplate, StaleTemplateError } from "@/db/templates/email-templates";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { multilineText, requiredText } from "@/lib/settings-input";

// 0: the workspace has no row for the event yet (it shows the default).
const expectedVersion = z.int().nonnegative();

// The template as typed (UNI-03). The subject is one line (text() refuses every control character, CR and LF too);
// the body keeps its line breaks. A placeholder that is not one of the event's fields is refused here, at save time
// (FILE-05), on the field it is in.
const saveInput = z
  .strictObject({
    // The workspace the form was rendered for: a precondition only, never the write target (TEN-11).
    workspaceId: z.uuid(),
    event: z.enum(EMAIL_EVENTS),
    expectedVersion,
    subject: requiredText(EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH),
    body: multilineText(EMAIL_TEMPLATE_BODY_MAX_LENGTH).pipe(z.string().min(1)),
  })
  .superRefine((value, context) => {
    for (const problem of templateProblems(value, EMAIL_TEMPLATE_DEFAULTS[value.event].fields)) {
      context.addIssue({ code: "custom", path: ["part" in problem ? problem.part : "subject"], message: problem.kind });
    }
  });

const stale = (error: unknown): never => {
  if (error instanceof StaleTemplateError) throw new ActionRefusedError("STALE_VERSION");
  throw error;
};

// Email templates are Admin and Owner (spec line 792, "Templates, … email settings"); Staff are refused with FORBIDDEN. Each change
// is audited by event, version and the parts changed, never the text (email-templates.ts). Nothing sends from a template in Phase 2 (Q23).
export const saveEmailTemplateAction = action({
  name: "settings.email_template.update",
  minRole: "admin",
  input: saveInput,
  // The "Restore the default text" button posts intent=restore: the event's default is saved instead of what is typed
  // (audited as email_template.restored).
  fromForm: (form) => {
    const event = form.get("event");
    const restore = form.get("intent") === "restore" && isEmailEvent(event);
    return {
      workspaceId: form.get("workspaceId"),
      event,
      expectedVersion: Number(form.get("expectedVersion")),
      subject: restore ? EMAIL_TEMPLATE_DEFAULTS[event].subject : form.get("subject"),
      body: restore ? EMAIL_TEMPLATE_DEFAULTS[event].body : form.get("body"),
    };
  },
  // No echo: a subject or message can hold personal data (a direct contact address), so a refusal returns the field
  // paths only (PR 76 Review R1). With JavaScript the draft stays in the editor; without it the page says it was not kept.
  idempotent: false,
  // A form rendered for workspace A and posted after the session switched to B is refused before any write: the
  // versions alone cannot tell them apart (both are 0 for a template neither has saved). The write still goes to the
  // session's workspace (action(), TEN-11); the posted id is only compared with it.
  beforeTransaction: async (member, input) => {
    if (input.workspaceId !== member.workspaceId) throw new ActionRefusedError("WORKSPACE_CHANGED");
  },
  handler: async (ctx, { event, expectedVersion: version, subject, body }) => {
    try {
      const saved = await saveEmailTemplate(ctx.tx, event, { subject, body }, version, ctx.userId);
      return { version: saved.version, isDefault: saved.isDefault };
    } catch (error) {
      return stale(error);
    }
  },
});
