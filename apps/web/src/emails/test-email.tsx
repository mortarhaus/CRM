import { render } from "@react-email/render";

// Wording approved by Charlie (ASK 8 = A, 2026-11-01).
export const TEST_EMAIL_SUBJECT = "Test email from CRM";
export const TEST_EMAIL_BODY =
  "This is a test email sent from your CRM workspace settings. If you received it, email delivery works.";

function TestEmail() {
  return (
    <html lang="en">
      <body>
        <p>{TEST_EMAIL_BODY}</p>
      </body>
    </html>
  );
}

export async function renderTestEmail(): Promise<{ subject: string; html: string; text: string }> {
  const [html, text] = await Promise.all([render(<TestEmail />), render(<TestEmail />, { plainText: true })]);
  return { subject: TEST_EMAIL_SUBJECT, html, text };
}
