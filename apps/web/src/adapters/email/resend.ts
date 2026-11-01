import { type EmailAdapter, EmailSendError } from "./index";

export const RESEND_BASE_URL = "https://api.resend.com";

// Resend's `POST /emails` over fetch (no SDK). The base URL is injectable so tests use a local stand-in (UNI-11).
export function createResendAdapter(config: { apiKey: string; from: string; baseUrl: string }): EmailAdapter {
  return {
    async send(message) {
      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/emails`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: config.from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
        });
      } catch {
        throw new EmailSendError("resend", "network");
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new EmailSendError("resend", response.status);
      }
      const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
      if (typeof body?.id !== "string" || body.id === "") throw new EmailSendError("resend", "invalid-response");
      return { providerId: body.id };
    },
  };
}
