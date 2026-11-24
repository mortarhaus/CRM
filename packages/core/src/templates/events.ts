// The email template events, the fields each may use and their default text: Charlie's answer to Q23 (2026-11-24,
// he approved the builder's draft; DECISIONS 2026-11-24). This is the one place the defaults live: a workspace has no
// email_template row until it first saves one, and its page shows these until then. Changed only by a reviewed PR.
// Nothing sends from them in Phase 2 (UNI-05): the sending phase of each event reads them.

// Fields every event may use.
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
  // The owner notification. Not yet what the bank-details job sends (apps/web/src/emails/bank-details-changed.tsx,
  // Q18 wording of 2026-11-22): the two texts differ, so that job keeps its own until Charlie chooses (DECISIONS
  // 2026-11-24).
  payment_details_changed: {
    fields: [...COMMON_FIELDS, "changed_by", "changed_at", "change_summary"],
    subject: "Payment details changed on {{workspace_name}}",
    body: [
      "Hi,",
      "{{changed_by}} changed the payment details for {{workspace_name}} on {{changed_at}}.",
      "{{change_summary}}",
      "If you did not expect this change, review your workspace users and security settings now.",
    ].join("\n\n"),
  },
} as const satisfies Record<string, { fields: readonly string[]; subject: string; body: string }>;

export type EmailEvent = keyof typeof EMAIL_TEMPLATE_DEFAULTS;
export type TemplateField = (typeof EMAIL_TEMPLATE_DEFAULTS)[EmailEvent]["fields"][number];

export const EMAIL_EVENTS = Object.keys(EMAIL_TEMPLATE_DEFAULTS) as EmailEvent[];

export const isEmailEvent = (value: unknown): value is EmailEvent => typeof value === "string" && Object.hasOwn(EMAIL_TEMPLATE_DEFAULTS, value);
