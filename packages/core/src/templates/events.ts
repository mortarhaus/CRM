// The email template events, the fields each may use and their default text: Charlie's answer to Q23 (2026-11-24,
// he approved the builder's draft; DECISIONS 2026-11-24), except event 8, which keeps the Q18 text (2026-11-25).
// This is the one place the defaults live: a workspace has no email_template row until it first saves one, and its
// page shows these until then. Changed only by a reviewed PR.
// Only payment_details_changed sends today (the bank-details job); each other event is read by its sending phase.

// Fields every client email may use (not the owner notification).
export const COMMON_FIELDS = ["client_name", "workspace_name", "sender_name"] as const;

const SIGN_OFF = "Thank you,\n{{sender_name}}\n{{workspace_name}}";

export const EMAIL_TEMPLATE_DEFAULTS = {
  invoice_sent: {
    fields: [...COMMON_FIELDS, "invoice_number", "amount_due", "due_date", "invoice_link"],
    subject: "Invoice {{invoice_number}} from {{workspace_name}}",
    body: [
      "Hi {{client_name}},",
      "Please find invoice {{invoice_number}} for {{amount_due}}, due on {{due_date}}.",
      "View and pay it here: {{invoice_link}}",
      SIGN_OFF,
    ].join("\n\n"),
  },
  payment_reminder: {
    fields: [...COMMON_FIELDS, "invoice_number", "amount_due", "due_date", "invoice_link"],
    subject: "Reminder: invoice {{invoice_number}} is due {{due_date}}",
    body: [
      "Hi {{client_name}},",
      "A quick reminder that invoice {{invoice_number}} for {{amount_due}} is due on {{due_date}}.",
      "You can view and pay it here: {{invoice_link}}",
      "If you have already paid, please ignore this message.",
      SIGN_OFF,
    ].join("\n\n"),
  },
  payment_receipt: {
    fields: [...COMMON_FIELDS, "invoice_number", "amount_paid", "paid_date", "receipt_link"],
    subject: "Receipt for invoice {{invoice_number}}",
    body: [
      "Hi {{client_name}},",
      "Thank you. We received your payment of {{amount_paid}} on {{paid_date}} for invoice {{invoice_number}}.",
      "Your receipt: {{receipt_link}}",
      SIGN_OFF,
    ].join("\n\n"),
  },
  payment_voided: {
    fields: [...COMMON_FIELDS, "invoice_number", "amount_voided", "voided_date", "invoice_link"],
    subject: "Payment on invoice {{invoice_number}} was reversed",
    body: [
      "Hi {{client_name}},",
      "The payment of {{amount_voided}} recorded on invoice {{invoice_number}} was reversed on {{voided_date}}. The invoice is open again.",
      "View it here: {{invoice_link}}",
      "If you think this is a mistake, please reply to this email.",
      SIGN_OFF,
    ].join("\n\n"),
  },
  quote_sent: {
    fields: [...COMMON_FIELDS, "quote_number", "total", "valid_until", "quote_link"],
    subject: "Quote {{quote_number}} from {{workspace_name}}",
    body: [
      "Hi {{client_name}},",
      "Here is quote {{quote_number}} for {{total}}. It is valid until {{valid_until}}.",
      "Review and respond here: {{quote_link}}",
      SIGN_OFF,
    ].join("\n\n"),
  },
  proposal_sent: {
    fields: [...COMMON_FIELDS, "proposal_title", "proposal_link"],
    subject: "Proposal: {{proposal_title}}",
    body: [
      "Hi {{client_name}},",
      'Thank you for the conversation. Our proposal "{{proposal_title}}" is ready for you.',
      "Read it here: {{proposal_link}}",
      "Please let me know if you have any questions.",
      SIGN_OFF,
    ].join("\n\n"),
  },
  agreement_sent: {
    fields: [...COMMON_FIELDS, "agreement_title", "agreement_link"],
    subject: "Agreement for your review: {{agreement_title}}",
    body: [
      "Hi {{client_name}},",
      'Please review and sign "{{agreement_title}}" here: {{agreement_link}}',
      "Reply to this email if anything needs changing before you sign.",
      SIGN_OFF,
    ].join("\n\n"),
  },
  // The owner notification on a bank-details or payment QR change. Charlie kept the Q18 text that the bank-details
  // job already sends (approved 2026-11-22; on 2026-11-25 it superseded the Q23 draft for this event), and that job
  // reads this default. It goes to the owner, not a client: no client_name or sender_name. It never shows a bank value.
  payment_details_changed: {
    fields: ["owner_name", "workspace_name", "changed_at", "changed_by", "what_changed"],
    subject: "Payment details changed on {{workspace_name}}",
    body: [
      "Hi {{owner_name}},",
      "The payment details for {{workspace_name}} were changed on {{changed_at}} by {{changed_by}}.",
      "What changed: {{what_changed}}.",
      "For your safety this email never shows account numbers.",
      "If you didn't expect this change, open Settings, then Payment, and review it now.",
    ].join("\n\n"),
  },
} as const satisfies Record<string, { fields: readonly string[]; subject: string; body: string }>;

export type EmailEvent = keyof typeof EMAIL_TEMPLATE_DEFAULTS;
export type TemplateField = (typeof EMAIL_TEMPLATE_DEFAULTS)[EmailEvent]["fields"][number];

export const EMAIL_EVENTS = Object.keys(EMAIL_TEMPLATE_DEFAULTS) as EmailEvent[];

export const isEmailEvent = (value: unknown): value is EmailEvent => typeof value === "string" && Object.hasOwn(EMAIL_TEMPLATE_DEFAULTS, value);
