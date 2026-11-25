import { describe, expect, it } from "vitest";
import { EMAIL_EVENTS, EMAIL_TEMPLATE_DEFAULTS } from "./events";
import { render, renderParts, TemplateFieldError, templateProblems } from "./render";

const ALLOWED = ["client_name", "x"];

describe("render (FILE-05, FILE-06; plan Task 24)", () => {
  it("fills each field in one pass", () => {
    expect(render("Hi {{client_name}}, {{x}}.", { client_name: "Aisha", x: "bye" }, ALLOWED)).toBe("Hi Aisha, bye.");
  });

  it("never expands a value that holds {{x}}", () => {
    expect(render("Hi {{client_name}}", { client_name: "{{x}}", x: "expanded" }, ALLOWED)).toBe("Hi {{x}}");
  });

  it("escapes a value and the template's own text for HTML", () => {
    expect(render("<b>{{client_name}}</b>", { client_name: `<script>alert("1")</script> & 'co'`, x: "" }, ALLOWED)).toBe(
      "&lt;b&gt;&lt;script&gt;alert(&quot;1&quot;)&lt;/script&gt; &amp; &#39;co&#39;&lt;/b&gt;",
    );
  });

  it("refuses a field that is not allowed or has no value", () => {
    expect(() => render("{{secret}}", { secret: "s" }, ALLOWED)).toThrow(TemplateFieldError);
    expect(() => render("{{x}}", {}, ALLOWED)).toThrow(TemplateFieldError);
    // An inherited property is not a value.
    expect(() => render("{{x}}", Object.create({ x: "inherited" }) as Record<string, string>, ALLOWED)).toThrow(TemplateFieldError);
  });

  it("keeps text that is not a placeholder as written, and names the parts", () => {
    expect(renderParts("{X} {x} {{client_name}}", { client_name: "A" }, ALLOWED)).toEqual([
      { field: null, text: "{X} {x} " },
      { field: "client_name", text: "A" },
    ]);
    // {{X}} is not a field name: refused at save, and not rendered as text either.
    expect(() => renderParts("{{X}}", {}, ALLOWED)).toThrow(TemplateFieldError);
  });
});

describe("templateProblems (refused at save time)", () => {
  it("refuses an unknown or malformed field, in the subject or the body", () => {
    expect(templateProblems({ subject: "{{invoice_total}}", body: "{{Client Name}} {{client_name}}" }, ALLOWED)).toEqual([
      { kind: "unknown_field", part: "subject", field: "invoice_total" },
      { kind: "unknown_field", part: "body", field: "Client Name" },
    ]);
  });

  it.each(["A\r\nBcc: x@example.test", "A\nB", "A\rB"])("refuses a line break in the subject: %j", (subject) => {
    expect(templateProblems({ subject, body: "fine" }, ALLOWED)).toEqual([{ kind: "subject_line_break" }]);
  });

  // Review R1 (PR #75): unclosed and nested placeholders were accepted, and the renderer half-expanded the nested one.
  it.each(["subject", "body"] as const)("refuses an unclosed placeholder in the %s", (part) => {
    const template = { subject: "Hi", body: "Hi", [part]: "From {{workspace_name" };
    expect(templateProblems(template, ["workspace_name"])).toEqual([{ kind: "malformed_placeholder", part, text: "{{" }]);
    expect(() => renderParts(template[part], { workspace_name: "Studio" }, ["workspace_name"])).toThrow(TemplateFieldError);
  });

  it.each(["subject", "body"] as const)("refuses a nested placeholder in the %s, and renders none of it", (part) => {
    const template = { subject: "Hi", body: "Hi", [part]: "{{misspelled {{workspace_name}} }}" };
    expect(templateProblems(template, ["workspace_name"])).toEqual([
      { kind: "malformed_placeholder", part, text: "{{" },
      { kind: "malformed_placeholder", part, text: "}}" },
    ]);
    expect(() => renderParts(template[part], { workspace_name: "Studio" }, ["workspace_name"])).toThrow(TemplateFieldError);
  });

  it.each(["}} after", "{{{client_name}}}"])("refuses stray double braces: %j", (subject) => {
    expect(templateProblems({ subject, body: "fine" }, ALLOWED)).toContainEqual(expect.objectContaining({ kind: "malformed_placeholder", part: "subject" }));
  });

  it("keeps single braces as text, and substitutes fields next to them", () => {
    const template = "Price {in MYR} {x}: {{client_name}}{{x}} {a}b}";
    expect(templateProblems({ subject: template, body: template }, ALLOWED)).toEqual([]);
    expect(render(template, { client_name: "A", x: "B" }, ALLOWED)).toBe("Price {in MYR} {x}: AB {a}b}");
  });

  it("accepts a body over several lines", () => {
    expect(templateProblems({ subject: "Hi {{client_name}}", body: "Line one\n\n{{x}}" }, ALLOWED)).toEqual([]);
  });
});

describe("the Q23 defaults", () => {
  it("has the eight approved events", () => {
    expect(EMAIL_EVENTS).toEqual([
      "invoice_sent",
      "payment_reminder",
      "payment_receipt",
      "payment_voided",
      "quote_sent",
      "proposal_sent",
      "agreement_sent",
      "payment_details_changed",
    ]);
  });

  it.each(EMAIL_EVENTS)("%s: its default uses only its own fields and saves as it is", (event) => {
    const { fields, subject, body } = EMAIL_TEMPLATE_DEFAULTS[event];
    expect(templateProblems({ subject, body }, fields)).toEqual([]);
    // And it renders through the same tokens, every placeholder filled.
    const values = Object.fromEntries(fields.map((field) => [field, "value"]));
    expect(render(body, values, fields)).not.toMatch(/\{\{|\}\}/);
    if (event !== "payment_details_changed") expect(fields.slice(0, 3)).toEqual(["client_name", "workspace_name", "sender_name"]);
  });

  it("keeps the Q18 owner notification text for event 8, with no client fields", () => {
    const { fields, subject, body } = EMAIL_TEMPLATE_DEFAULTS.payment_details_changed;
    expect(fields).toEqual(["owner_name", "workspace_name", "changed_at", "changed_by", "what_changed"]);
    expect(subject).toBe("Payment details changed on {{workspace_name}}");
    expect(body).toBe(
      "Hi {{owner_name}},\n\nThe payment details for {{workspace_name}} were changed on {{changed_at}} by {{changed_by}}.\n\n" +
        "What changed: {{what_changed}}.\n\nFor your safety this email never shows account numbers.\n\n" +
        "If you didn't expect this change, open Settings, then Payment, and review it now.",
    );
  });

  it("keeps the approved invoice text", () => {
    const { fields, subject, body } = EMAIL_TEMPLATE_DEFAULTS.invoice_sent;
    const values = Object.fromEntries(fields.map((field) => [field, `<${field}>`]));
    expect(render(subject, values, fields)).toBe("Invoice &lt;invoice_number&gt; from &lt;workspace_name&gt;");
    expect(body).toBe(
      "Hi {{client_name}},\n\nPlease find invoice {{invoice_number}} for {{amount_due}}, due on {{due_date}}.\n\n" +
        "View and pay it here: {{invoice_link}}\n\nThank you,\n{{sender_name}}\n{{workspace_name}}",
    );
  });
});
