import type { EmailEnv } from "../../lib/env";
import { createResendAdapter, RESEND_BASE_URL } from "./resend";
import { createSmtpAdapter } from "./smtp";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<{ providerId: string }>;
}

// UNI-09: the message names the provider and its status (an SMTP reply code, an HTTP status or a short failure
// code) and nothing else. No address, no key, no provider response text, and no `cause`, since the original error
// can hold the recipient.
export class EmailSendError extends Error {
  override name = "EmailSendError";

  constructor(
    readonly provider: EmailEnv["EMAIL_PROVIDER"],
    readonly status: number | string,
  ) {
    super(`Email send failed (${provider}): ${status}`);
  }
}

export function createEmailAdapter(env: EmailEnv, options: { resendBaseUrl?: string } = {}): EmailAdapter {
  if (env.EMAIL_PROVIDER === "smtp") {
    if (env.SMTP_URL === undefined) throw new Error("SMTP_URL is not set");
    return createSmtpAdapter({ url: env.SMTP_URL, from: env.EMAIL_FROM });
  }
  if (env.RESEND_API_KEY === undefined) throw new Error("RESEND_API_KEY is not set");
  return createResendAdapter({
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    baseUrl: options.resendBaseUrl ?? RESEND_BASE_URL,
  });
}
