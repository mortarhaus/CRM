import { describe, expect, it } from "vitest";
import { BANK_DETAILS_CHANGED_DEFAULT, renderBankDetailsChangedEmail } from "./bank-details-changed";

const FIELDS = {
  owner_name: "Aisha",
  workspace_name: "Studio Sdn Bhd",
  changed_at: "23-Nov-2026 09:15 (Asia/Kuala_Lumpur)",
  changed_by: "Ben",
  what_changed: "bank details",
};

describe("renderBankDetailsChangedEmail (plan Task 16, Q18 wording)", () => {
  it("fills Charlie's approved subject and body", async () => {
    const email = await renderBankDetailsChangedEmail(FIELDS);
    expect(email.subject).toBe("Payment details changed on Studio Sdn Bhd");
    const text = email.text.replace(/\s+/g, " ");
    for (const sentence of [
      "Hi Aisha,",
      "The payment details for Studio Sdn Bhd were changed on 23-Nov-2026 09:15 (Asia/Kuala_Lumpur) by Ben.",
      "What changed: bank details.",
      "For your safety this email never shows account numbers.",
      "If you didn't expect this change, open Settings, then Payment, and review it now.",
    ]) {
      expect(text).toContain(sentence);
    }
    expect(email.html).toContain("<p>Hi Aisha,</p>");
  });

  it("keeps the default text in {{field}} form (the PR 8 email_template default)", () => {
    expect(BANK_DETAILS_CHANGED_DEFAULT.subject).toBe("Payment details changed on {{workspace_name}}");
    expect(BANK_DETAILS_CHANGED_DEFAULT.body.match(/\{\{[a-z_]+\}\}/g)).toEqual([
      "{{owner_name}}",
      "{{workspace_name}}",
      "{{changed_at}}",
      "{{changed_by}}",
      "{{what_changed}}",
    ]);
  });

  it("is single pass and escapes HTML (FILE-05, FILE-06)", async () => {
    const email = await renderBankDetailsChangedEmail({
      ...FIELDS,
      workspace_name: "<script>alert(1)</script>{{owner_name}}",
      changed_by: "Ben\r\nBcc: x@example.test",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("{{owner_name}}");
    expect(email.subject).toBe("Payment details changed on <script>alert(1)</script>{{owner_name}}");
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
