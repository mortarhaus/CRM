import { describe, expect, it } from "vitest";
import { EVENT_NAMES, type EventName } from "./names";

describe("EVENT_NAMES (spec \"Domain events and jobs\", Part 1 event set)", () => {
  it("is the spec's 23 Part 1 events, each once", () => {
    expect(EVENT_NAMES).toHaveLength(23);
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
    expect([...EVENT_NAMES].sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it("leaves out the events reserved for the e-invoice extension (Part 3)", () => {
    expect(EVENT_NAMES).not.toContain("einvoice.validated");
    expect(EVENT_NAMES).not.toContain("einvoice.rejected");
  });

  it("types an event name as one of the set", () => {
    const name: EventName = "invoice.paid";
    // @ts-expect-error not a Part 1 event
    const other: EventName = "einvoice.validated";
    expect([name, other]).toHaveLength(2);
  });
});
