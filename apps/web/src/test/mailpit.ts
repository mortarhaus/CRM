// Mailpit 1.33.0, pinned by tag and index digest like docker/compose.dev.yml (docs/DECISIONS.md 2026-11-01).
export const MAILPIT_IMAGE =
  "axllent/mailpit:v1.33.0@sha256:9b3a463be15354c0f0eba91697d80e3e0d8a5623ef0e627cacc836bc17fd5231";

export interface MailpitMessage {
  ID: string;
  Subject: string;
  To: { Name: string; Address: string }[];
}

// The dev compose Mailpit (UI and API on localhost:8025), unless MAILPIT_URL names another one: a run whose 8025 is
// taken starts its own Mailpit and passes its address.
export function mailpitUrl(): string {
  return process.env.MAILPIT_URL ?? "http://localhost:8025";
}

export interface MailpitMessageBody {
  Subject: string;
  Text: string;
  HTML: string;
}

// One message's subject and bodies (`GET /api/v1/message/{id}`).
export async function getMessage(id: string, base: string = mailpitUrl()): Promise<MailpitMessageBody> {
  const response = await fetch(`${base}/api/v1/message/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Mailpit message answered ${response.status}`);
  return (await response.json()) as MailpitMessageBody;
}

// The messages Mailpit holds for one recipient (`GET /api/v1/search`).
export async function searchMessages(to: string, base: string = mailpitUrl()): Promise<MailpitMessage[]> {
  const query = new URLSearchParams({ query: `to:"${to}"` });
  const response = await fetch(`${base}/api/v1/search?${query.toString()}`);
  if (!response.ok) throw new Error(`Mailpit search answered ${response.status}`);
  return ((await response.json()) as { messages: MailpitMessage[] }).messages;
}
