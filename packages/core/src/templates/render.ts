// User-editable email templates (FILE-05, FILE-06; Phase 2 plan Task 24). A template is plain text with {{field}}
// placeholders: one pass, no expressions, no includes, no code.

const FIELD = /\{\{([a-z_]+)\}\}/g;
// Anything that looks like a placeholder, including a malformed one ({{Client Name}}): checked at save time so a
// typo is refused rather than sent as written.
const ANY_PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

export class TemplateFieldError extends Error {
  constructor(readonly field: string) {
    super(`template field not allowed or not given: ${field}`);
    this.name = "TemplateFieldError";
  }
}

// One piece of a filled template: text as written (field null), or a field's value.
export interface TemplatePart {
  field: string | null;
  text: string;
}

// A single pass over the template: each {{field}} is replaced by its value, and a value is never scanned again, so
// a value holding {{x}} stays as written (FILE-05). A field not in allowedFields, or with no value, throws
// TemplateFieldError (a saved template has none: templateProblems refuses them first).
export function renderParts(template: string, fields: Readonly<Record<string, string>>, allowedFields: readonly string[]): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let at = 0;
  for (const match of template.matchAll(FIELD)) {
    const name = match[1] ?? "";
    const value = Object.hasOwn(fields, name) ? fields[name] : undefined;
    if (!allowedFields.includes(name) || value === undefined) throw new TemplateFieldError(name);
    if (match.index > at) parts.push({ field: null, text: template.slice(at, match.index) });
    parts.push({ field: name, text: value });
    at = match.index + match[0].length;
  }
  if (at < template.length) parts.push({ field: null, text: template.slice(at) });
  return parts;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);

// The filled template for an HTML body (FILE-06): the values and the template's own text are both escaped, so
// neither a client name nor an admin's template text can add markup.
export function render(template: string, fields: Readonly<Record<string, string>>, allowedFields: readonly string[]): string {
  return renderParts(template, fields, allowedFields)
    .map((part) => escapeHtml(part.text))
    .join("");
}

export type TemplateProblem =
  | { kind: "unknown_field"; part: "subject" | "body"; field: string }
  // A subject is one email header line: a CR or LF could add headers (header injection).
  | { kind: "subject_line_break" };

// What refuses a template at save time: a placeholder that is not one of the event's fields, and a line break in the
// subject. Empty when the template can be saved.
export function templateProblems(template: { subject: string; body: string }, allowedFields: readonly string[]): TemplateProblem[] {
  const problems: TemplateProblem[] = [];
  if (/[\r\n]/.test(template.subject)) problems.push({ kind: "subject_line_break" });
  for (const part of ["subject", "body"] as const) {
    for (const match of template[part].matchAll(ANY_PLACEHOLDER)) {
      const field = match[1] ?? "";
      if (!allowedFields.includes(field)) problems.push({ kind: "unknown_field", part, field });
    }
  }
  return problems;
}
