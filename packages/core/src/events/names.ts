// The Part 1 event set (spec "Domain events and jobs"). einvoice.validated and einvoice.rejected are reserved for the
// e-invoice extension (Part 3) and are not in it.
export const EVENT_NAMES = [
  "customer.created",
  "quotation.sent",
  "quotation.accepted",
  "quotation.expired",
  "proposal.sent",
  "proposal.approved",
  "proposal.declined",
  "invoice.issued",
  "invoice.sent",
  "invoice.paid",
  "invoice.credited",
  "invoice.overdue",
  "invoice.voided",
  "payment.recorded",
  "payment.voided",
  "refund.recorded",
  "refund.voided",
  "credit_note.issued",
  "credit_note.voided",
  "agreement.created",
  "agreement.sent",
  "agreement.signed",
  "agreement.superseded",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
