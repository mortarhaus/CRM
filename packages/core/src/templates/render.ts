// User-editable email templates (FILE-05, FILE-06; Phase 2 plan Task 24). A template is plain text with {{field}}
// placeholders: one pass, no expressions, no includes, no code.

// A placeholder is exactly {{name}}, name in a-z and _. Any other "{{" or "}}" is placeholder syntax gone wrong
// (unclosed, nested, stray, or a name such as {{Client Name}}): templateProblems refuses it at save time and
// renderParts throws on it, so both read a template as the same tokens. A single { or } is ordinary text.
const FIELD_AT = /\{\{([a-z_]+)\}\}/y;

type Token = { kind: "text"; text: string } | { kind: "field"; name: string } | { kind: "malformed"; text: string };

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  const textUpTo = (end: number) => {
    if (end > at) tokens.push({ kind: "text", text: template.slice(at, end) });
  };
  for (;;) {
    const open = template.indexOf("{{", at);
    const close = template.indexOf("}}", at);
    if (open === -1 && close === -1) break;
    if (open === -1 || (close !== -1 && close < open)) {
      // "}}" with no "{{" before it.
      textUpTo(close);
      tokens.push({ kind: "malformed", text: "}}" });
      at = close + 2;
      continue;
    }
    textUpTo(open);
    FIELD_AT.lastIndex = open;
    const field = FIELD_AT.exec(template);
    if (field) {
      tokens.push({ kind: "field", name: field[1] ?? "" });
      at = open + field[0].length;
      continue;
    }
    // Not a field: it runs to the next "}}" unless another "{{" opens first (nested or unclosed: just the "{{").
    const nextOpen = template.indexOf("{{", open + 2);
    const nextClose = template.indexOf("}}", open + 2);
    const end = nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen) ? nextClose + 2 : open + 2;
    tokens.push({ kind: "malformed", text: template.slice(open, end) });
    at = end;
  }
  textUpTo(template.length);
  return tokens;
}

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
// a value holding {{x}} stays as written (FILE-05). A field not in allowedFields, one with no value, or malformed
// placeholder syntax throws TemplateFieldError (a saved template has none: templateProblems refuses them first).
export function renderParts(template: string, fields: Readonly<Record<string, string>>, allowedFields: readonly string[]): TemplatePart[] {
  return tokenize(template).map((token) => {
    if (token.kind === "text") return { field: null, text: token.text };
    if (token.kind === "malformed") throw new TemplateFieldError(token.text);
    const value = Object.hasOwn(fields, token.name) ? fields[token.name] : undefined;
    if (!allowedFields.includes(token.name) || value === undefined) throw new TemplateFieldError(token.name);
    return { field: token.name, text: value };
  });
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
  // Placeholder syntax that is not {{name}}: unclosed ({{workspace_name), nested, or a stray }}.
  | { kind: "malformed_placeholder"; part: "subject" | "body"; text: string }
  // A subject is one email header line: a CR or LF could add headers (header injection).
  | { kind: "subject_line_break" };

// What refuses a template at save time: a placeholder that is not one of the event's fields, malformed placeholder
// syntax, and a line break in the subject. Empty when the template can be saved.
export function templateProblems(template: { subject: string; body: string }, allowedFields: readonly string[]): TemplateProblem[] {
  const problems: TemplateProblem[] = [];
  if (/[\r\n]/.test(template.subject)) problems.push({ kind: "subject_line_break" });
  for (const part of ["subject", "body"] as const) {
    for (const token of tokenize(template[part])) {
      if (token.kind === "field" && !allowedFields.includes(token.name)) problems.push({ kind: "unknown_field", part, field: token.name });
      if (token.kind !== "malformed") continue;
      // A closed one such as {{Client Name}} is a field name that does not exist.
      const named = /^\{\{([^{}]*)\}\}$/.exec(token.text);
      problems.push(named ? { kind: "unknown_field", part, field: named[1] ?? "" } : { kind: "malformed_placeholder", part, text: token.text });
    }
  }
  return problems;
}
