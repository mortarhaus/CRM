"use client";

import { EMAIL_TEMPLATE_DEFAULTS, type EmailEvent, renderParts, type TemplateProblem, templateProblems } from "@crm/core/templates";
import { redirect, useRouter } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { RenderedWorkspace } from "@/components/rendered-workspace";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/auth/action";
import {
  TEMPLATE_BODY,
  TEMPLATE_BODY_INVALID,
  TEMPLATE_BODY_REFUSED,
  TEMPLATE_DRAFT_NOT_KEPT,
  TEMPLATE_FAILED,
  TEMPLATE_FIELDS_HINT,
  TEMPLATE_INVALID,
  TEMPLATE_IS_DEFAULT,
  TEMPLATE_MALFORMED_PLACEHOLDER,
  TEMPLATE_NO_PREVIEW,
  TEMPLATE_PREVIEW,
  TEMPLATE_PREVIEW_HINT,
  TEMPLATE_RESTORE,
  TEMPLATE_RESTORE_HINT,
  TEMPLATE_RESTORED,
  TEMPLATE_SAMPLE_VALUES,
  TEMPLATE_SAVE,
  TEMPLATE_SAVED,
  TEMPLATE_SAVING,
  TEMPLATE_STALE,
  TEMPLATE_SUBJECT,
  TEMPLATE_SUBJECT_INVALID,
  TEMPLATE_SUBJECT_REFUSED,
  TEMPLATES_FORBIDDEN,
  unknownFieldsMessage,
  WORKSPACE_CHANGED_MESSAGE,
} from "@/lib/auth/messages";

type SaveResult = ActionResult<{ version: number; isDefault: boolean }>;
// A template action, called as (previous state, form data): it reads the form (action() fromForm).
type FormAction = (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;

export interface TemplateValues {
  event: EmailEvent;
  subject: string;
  body: string;
  version: number;
  isDefault: boolean;
}

interface FormProps {
  action: FormAction;
  // The workspace the template was read from; the action refuses the post if the session has since switched.
  workspaceId: string;
  template: TemplateValues;
}

const REFUSALS: Partial<Record<string, string>> = {
  INVALID_INPUT: TEMPLATE_INVALID,
  STALE_VERSION: TEMPLATE_STALE,
  WORKSPACE_CHANGED: WORKSPACE_CHANGED_MESSAGE,
  FORBIDDEN: TEMPLATES_FORBIDDEN,
};

// The typed template filled with sample data by the same single pass a send will run (renderParts; every field has a
// sample, so only an unknown field or malformed placeholder syntax stops it); React escapes every part. Watermarked "Preview", never stored or sent
// (REC-12).
function Preview({ event, subject, body }: { event: EmailEvent; subject: string; body: string }) {
  const fields = EMAIL_TEMPLATE_DEFAULTS[event].fields;
  const reason = placeholderReason(templateProblems({ subject, body }, fields));
  const fill = (text: string) =>
    renderParts(text, TEMPLATE_SAMPLE_VALUES, fields)
      .map((part) => part.text)
      .join("");
  return (
    // The faint diagonal watermark is a pseudo-element (data-watermark), decoration beside the "Preview" heading.
    <section
      aria-labelledby="preview-heading"
      data-watermark={TEMPLATE_PREVIEW}
      className="relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-md border-2 border-dashed border-border bg-card p-4 before:pointer-events-none before:absolute before:inset-0 before:flex before:-rotate-12 before:items-center before:justify-center before:text-6xl before:font-bold before:tracking-widest before:text-muted-foreground/15 before:uppercase before:content-[attr(data-watermark)] before:select-none"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 id="preview-heading" className="rounded-sm bg-muted px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
          {TEMPLATE_PREVIEW}
        </h3>
        <p className="text-sm text-muted-foreground">{TEMPLATE_PREVIEW_HINT}</p>
      </div>
      {reason === undefined ? (
        <div className="flex flex-col gap-3 text-sm break-words">
          <p className="font-semibold">{fill(subject)}</p>
          <p className="whitespace-pre-wrap">{fill(body)}</p>
        </div>
      ) : (
        <p className="text-sm text-destructive">
          {TEMPLATE_NO_PREVIEW}: {reason}
        </p>
      )}
    </section>
  );
}

type Part = "subject" | "body";

// Why the placeholders of a text cannot be filled (unknown fields first), or undefined when they can.
function placeholderReason(problems: TemplateProblem[]): string | undefined {
  const unknown = problems.flatMap((problem) => (problem.kind === "unknown_field" ? [problem.field] : []));
  if (unknown.length > 0) return unknownFieldsMessage([...new Set(unknown)]);
  return problems.some((problem) => problem.kind === "malformed_placeholder") ? TEMPLATE_MALFORMED_PLACEHOLDER : undefined;
}

type Posted = { subject: string; body: string };

// The subject, the message and their preview. Keyed by the stored version, so a save or a restore shows the stored
// text; a refusal keeps what was typed, in this component's state. The action echoes no text (a template can hold
// personal data), so without JavaScript a refused page shows the stored text again and says so.
function Editor({ template, refused, posted }: { template: TemplateValues; refused: { fields: string[] } | null; posted: Posted | null }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const fields = EMAIL_TEMPLATE_DEFAULTS[template.event].fields;
  // Why the posted text was refused, from the copy kept in the browser when it was posted, whatever has been typed
  // since. Without that copy (no JavaScript), the general rule for the field.
  const fieldError = (part: Part) => {
    if (!refused?.fields.includes(part)) return undefined;
    if (posted === null) return part === "subject" ? TEMPLATE_SUBJECT_REFUSED : TEMPLATE_BODY_REFUSED;
    const reason = placeholderReason(templateProblems(posted, fields).filter((problem) => "part" in problem && problem.part === part));
    return reason ?? (part === "subject" ? TEMPLATE_SUBJECT_INVALID : TEMPLATE_BODY_INVALID);
  };
  const describedBy = (part: Part) => ["template-fields-hint", fieldError(part) && `template-${part}-error`].filter(Boolean).join(" ");

  return (
    <>
      <p id="template-fields-hint" className="text-sm break-words text-muted-foreground">
        {TEMPLATE_FIELDS_HINT} {fields.map((field) => `{{${field}}}`).join(", ")}
      </p>
      {template.isDefault && <p className="text-sm">{TEMPLATE_IS_DEFAULT}</p>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-subject">{TEMPLATE_SUBJECT}</Label>
        <Input
          id="template-subject"
          name="subject"
          type="text"
          autoComplete="off"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          aria-invalid={fieldError("subject") ? true : undefined}
          aria-describedby={describedBy("subject")}
        />
        {fieldError("subject") && (
          <p id="template-subject-error" className="text-sm text-destructive">
            {fieldError("subject")}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-body">{TEMPLATE_BODY}</Label>
        <Textarea
          id="template-body"
          name="body"
          rows={12}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={fieldError("body") ? true : undefined}
          aria-describedby={describedBy("body")}
        />
        {fieldError("body") && (
          <p id="template-body-error" className="text-sm text-destructive">
            {fieldError("body")}
          </p>
        )}
      </div>
      <Preview event={template.event} subject={subject} body={body} />
    </>
  );
}

function TemplateFields({ action, workspaceId, template, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  // A save is rendered again from the stored row (the version moves on). Focus goes back to Save, which was disabled
  // while the post was in flight (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);
  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result?.ok === false ? (REFUSALS[result.status] ?? TEMPLATE_FAILED) : unreachable ? TEMPLATE_FAILED : null;
  const refused = result?.ok === false && result.status === "INVALID_INPUT" ? result : null;
  const version = result?.ok ? Math.max(result.data.version, template.version) : template.version;
  // What this browser posted, so a refusal can say why without the action sending the text back. Null when the page
  // was rendered from a post made without JavaScript.
  const [posted, setPosted] = useState<Posted | null>(null);

  // The button that posted names the intent (save, or restore the default).
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
    setPosted({ subject: String(form.get("subject") ?? ""), body: String(form.get("body") ?? "") });
    startTransition(() => formAction(form));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
      <RenderedWorkspace id={workspaceId} />
      <input type="hidden" name="event" value={template.event} />
      <input type="hidden" name="expectedVersion" value={version} />
      <Editor key={template.version} template={template} refused={refused} posted={posted} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {refused && posted === null && ` ${TEMPLATE_DRAFT_NOT_KEPT}`}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {result.data.isDefault ? TEMPLATE_RESTORED : TEMPLATE_SAVED}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button ref={button} type="submit" name="intent" value="save" disabled={pending}>
          {pending ? TEMPLATE_SAVING : TEMPLATE_SAVE}
        </Button>
        {!template.isDefault && (
          <Button type="submit" name="intent" value="restore" variant="outline" disabled={pending} aria-describedby="template-restore-hint">
            {TEMPLATE_RESTORE}
          </Button>
        )}
      </div>
      {!template.isDefault && (
        <p id="template-restore-hint" className="text-sm text-muted-foreground">
          {TEMPLATE_RESTORE_HINT}
        </p>
      )}
    </form>
  );
}

export function TemplateForm(props: FormProps) {
  return <SubmitFailureBoundary>{(unreachable) => <TemplateFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}
