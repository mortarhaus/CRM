import { EMAIL_TEMPLATE_DEFAULTS } from "@crm/core/templates";
import { render } from "@react-email/render";

// The owner email on a bank-details or payment QR change (spec "Authorization"; Phase 2 plan Task 16, Q18). Its text is
// the payment_details_changed default in core (EMAIL_TEMPLATE_DEFAULTS): Charlie's Q18 wording of 2026-11-22, kept for
// event 8 on 2026-11-25. A test pins the rendered email byte for byte to what this job sent before it read core.
// It never shows a bank value: no account number, holder name or QR (what_changed names only the kind).
const { subject, body } = EMAIL_TEMPLATE_DEFAULTS.payment_details_changed;
export const BANK_DETAILS_CHANGED_DEFAULT = { subject, body } as const;

export type BankDetailsChangedFields = Record<(typeof EMAIL_TEMPLATE_DEFAULTS.payment_details_changed.fields)[number], string>;

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
