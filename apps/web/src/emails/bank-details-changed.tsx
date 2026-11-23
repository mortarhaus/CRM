import { render } from "@react-email/render";

// The owner email on a bank-details or payment QR change (spec "Authorization"; Phase 2 plan Task 16, Q18). Wording
// approved by Charlie on 2026-11-22. This default is the one place the text lives: the email_template table of plan
// PR 8 (UNI-05) takes it over as this event's default, so it is written as {{field}} text, as that table stores it.
// It never shows a bank value: no account number, holder name or QR (what_changed names only the kind).
export const BANK_DETAILS_CHANGED_DEFAULT = {
  subject: "Payment details changed on {{workspace_name}}",
  body: [
    "Hi {{owner_name}},",
    "The payment details for {{workspace_name}} were changed on {{changed_at}} by {{changed_by}}.",
    "What changed: {{what_changed}}.",
    "For your safety this email never shows account numbers.",
    "If you didn't expect this change, open Settings, then Payment, and review it now.",
  ].join("\n\n"),
} as const;

export type BankDetailsChangedFields = Record<
  "owner_name" | "workspace_name" | "changed_at" | "changed_by" | "what_changed",
  string
>;

// Single pass (FILE-05): String.replace never scans what a field put in, so a value holding {{x}} stays as written. A
// name with no field is left as written. Escaping is React's: every value is a text child (FILE-06).
function fill(text: string, fields: BankDetailsChangedFields): string {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (whole, name: string) =>
    Object.hasOwn(fields, name) ? fields[name as keyof BankDetailsChangedFields] : whole,
  );
}

function BankDetailsChangedEmail({ paragraphs }: { paragraphs: string[] }) {
  return (
    <html lang="en">
      <body>
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </body>
    </html>
  );
}

export async function renderBankDetailsChangedEmail(
  fields: BankDetailsChangedFields,
): Promise<{ subject: string; html: string; text: string }> {
  const paragraphs = fill(BANK_DETAILS_CHANGED_DEFAULT.body, fields).split("\n\n");
  const email = <BankDetailsChangedEmail paragraphs={paragraphs} />;
  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  // A subject is one header line.
  const subject = fill(BANK_DETAILS_CHANGED_DEFAULT.subject, fields).replace(/[\r\n]+/g, " ");
  return { subject, html, text };
}
