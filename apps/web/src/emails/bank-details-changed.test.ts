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

  // What the job sent before it read the core default (renderBankDetailsChangedEmail at main 9b8a6d0, captured
  // 2026-11-25). Byte for byte: moving the text to core changes nothing sent.
  it.each([
    ["plain", FIELDS, {"subject": "Payment details changed on Studio Sdn Bhd", "html": "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\"><html lang=\"en\"><head></head><body><!--$--><!--html--><!--body--><p>Hi Aisha,</p><p>The payment details for Studio Sdn Bhd were changed on 23-Nov-2026 09:15 (Asia/Kuala_Lumpur) by Ben.</p><p>What changed: bank details.</p><p>For your safety this email never shows account numbers.</p><p>If you didn&#x27;t expect this change, open Settings, then Payment, and review it now.</p><!--/$--></body></html>", "text": "Hi Aisha,\n\nThe payment details for Studio Sdn Bhd were changed on 23-Nov-2026 09:15 (Asia/Kuala_Lumpur) by Ben.\n\nWhat changed: bank details.\n\nFor your safety this email never shows account numbers.\n\nIf you didn't expect this change, open Settings, then Payment, and review it now."}],
    [
      "hostile",
      {
        owner_name: "A & <b>",
        workspace_name: "<script>alert(1)</script>{{owner_name}}",
        changed_at: "{{what_changed}}",
        changed_by: "Ben\r\nBcc: x@example.test",
        what_changed: "bank details and the payment QR",
      },
      {"subject": "Payment details changed on <script>alert(1)</script>{{owner_name}}", "html": "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Transitional//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd\"><html lang=\"en\"><head></head><body><!--$--><!--html--><!--body--><p>Hi A &amp; &lt;b&gt;,</p><p>The payment details for &lt;script&gt;alert(1)&lt;/script&gt;{{owner_name}} were changed on {{what_changed}} by Ben\r\nBcc: x@example.test.</p><p>What changed: bank details and the payment QR.</p><p>For your safety this email never shows account numbers.</p><p>If you didn&#x27;t expect this change, open Settings, then Payment, and review it now.</p><!--/$--></body></html>", "text": "Hi A & <b>,\n\nThe payment details for <script>alert(1)</script>{{owner_name}} were changed on {{what_changed}} by Ben Bcc: x@example.test.\n\nWhat changed: bank details and the payment QR.\n\nFor your safety this email never shows account numbers.\n\nIf you didn't expect this change, open Settings, then Payment, and review it now."},
    ],
  ] as const)("renders exactly what was sent before the text moved to core: %s", async (_, fields, sent) => {
    expect(await renderBankDetailsChangedEmail(fields)).toStrictEqual(sent);
  });
});
