import { createTransport } from "nodemailer";
import { type EmailAdapter, EmailSendError } from "./index";

function statusOf(error: unknown): number | string {
  if (typeof error !== "object" || error === null) return "unknown";
  const { responseCode, code } = error as { responseCode?: unknown; code?: unknown };
  if (typeof responseCode === "number") return responseCode;
  return typeof code === "string" ? code : "unknown";
}

export function createSmtpAdapter(config: { url: string; from: string }): EmailAdapter {
  const transport = createTransport(config.url);
  return {
    async send(message) {
      try {
        const info = await transport.sendMail({ from: config.from, ...message });
        return { providerId: info.messageId };
      } catch (error) {
        throw new EmailSendError("smtp", statusOf(error));
      }
    },
  };
}
