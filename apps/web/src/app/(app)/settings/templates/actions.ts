"use server";

import { EMAIL_TEMPLATE_BODY_MAX_LENGTH, EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH } from "@crm/core/security";
import { EMAIL_EVENTS, EMAIL_TEMPLATE_DEFAULTS, isEmailEvent, templateProblems } from "@crm/core/templates";
import { z } from "zod";
import { saveEmailTemplate, StaleTemplateError } from "@/db/templates/email-templates";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { echoFields, multilineText, requiredText } from "@/lib/settings-input";

// 0: the workspace has no row for the event yet (it shows the default).
const expectedVersion = z.int().nonnegative();

// The template as typed (UNI-03). The subject is one line (text() refuses every control character, CR and LF too);
// the body keeps its line breaks. A placeholder that is not one of the event's fields is refused here, at save time
// (FILE-05), on the field it is in.
const saveInput = z
  .strictObject({
    event: z.enum(EMAIL_EVENTS),
    expectedVersion,
    subject: requiredText(EMAIL_TEMPLATE_SUBJECT_MAX_LENGTH),
    body: multilineText(EMAIL_TEMPLATE_BODY_MAX_LENGTH).pipe(z.string().min(1)),
  })
  .superRefine((value, context) => {
    for (const problem of templateProblems(value, EMAIL_TEMPLATE_DEFAULTS[value.event].fields)) {
      context.addIssue({ code: "custom", path: [problem.kind === "unknown_field" ? problem.part : "subject"], message: problem.kind });
    }
  });

const stale = (error: unknown): never => {
  if (error instanceof StaleTemplateError) throw new ActionRefusedError("STALE_VERSION");
  throw error;
};

// Email templates are Admin and Owner (spec line 788, "email settings"); Staff are refused with FORBIDDEN. Each change
// is audited with the text before and after (email-templates.ts). Nothing sends from a template in Phase 2 (Q23).
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
      event,
      expectedVersion: Number(form.get("expectedVersion")),
      subject: restore ? EMAIL_TEMPLATE_DEFAULTS[event].subject : form.get("subject"),
      body: restore ? EMAIL_TEMPLATE_DEFAULTS[event].body : form.get("body"),
    };
  },
  // Workspace template text, neither personal data nor a secret.
  echo: (form) => echoFields(form, ["subject", "body"]),
  idempotent: false,
  handler: async (ctx, { event, expectedVersion: version, subject, body }) => {
    try {
      const saved = await saveEmailTemplate(ctx.tx, event, { subject, body }, version, ctx.userId);
      return { version: saved.version, isDefault: saved.isDefault };
    } catch (error) {
      return stale(error);
    }
  },
});
