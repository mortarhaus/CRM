import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderTestEmail, TEST_EMAIL_BODY, TEST_EMAIL_SUBJECT } from "../../emails/test-email";
import { MAILPIT_IMAGE } from "../../test/mailpit";
import { createEmailAdapter, type EmailAdapter, type EmailMessage, EmailSendError } from "./index";

const FROM = "CRM Test <crm@mail.example.test>";
const TO = "member@client.example.test";
const API_KEY = "re_contract_test_key";

interface Delivered {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface Harness {
  adapter: EmailAdapter;
  // What the provider received for the one message sent since the last reset.
  delivered(providerId: string): Promise<Delivered>;
  // The provider refuses the next message.
  refuseNext(): Promise<void>;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

const crlf = (value: string) => value.replace(/\r\n/g, "\n").trim();
const words = (value: string) => value.replace(/\s+/g, " ").trim();

async function startSmtp(): Promise<Harness> {
  // Chaos lets a test make Mailpit refuse a recipient (`PUT /api/v1/chaos`).
  const container: StartedTestContainer = await new GenericContainer(MAILPIT_IMAGE)
    .withExposedPorts(1025, 8025)
    .withEnvironment({ MP_ENABLE_CHAOS: "true" })
    .withWaitStrategy(Wait.forHttp("/readyz", 8025))
    .start();
  const api = `http://${container.getHost()}:${container.getMappedPort(8025)}/api/v1`;
  const chaos = (recipient: { ErrorCode: number; Probability: number }) =>
    fetch(`${api}/chaos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Recipient: recipient }),
    });
  return {
    adapter: createEmailAdapter({
      EMAIL_PROVIDER: "smtp",
      EMAIL_FROM: FROM,
      SMTP_URL: `smtp://${container.getHost()}:${container.getMappedPort(1025)}`,
    }),
    async delivered(providerId) {
      const list = (await (await fetch(`${api}/messages`)).json()) as { messages: { ID: string; MessageID: string }[] };
      expect(list.messages).toHaveLength(1);
      const [summary] = list.messages;
      expect(`<${summary?.MessageID}>`).toBe(providerId);
      const message = (await (await fetch(`${api}/message/${summary?.ID}`)).json()) as {
        From: { Name: string; Address: string };
        To: { Address: string }[];
        Subject: string;
        HTML: string;
        Text: string;
      };
      expect(message.To).toHaveLength(1);
      return {
        from: `${message.From.Name} <${message.From.Address}>`,
        to: message.To[0]?.Address ?? "",
        subject: message.Subject,
        html: message.HTML,
        text: message.Text,
      };
    },
    async refuseNext() {
      expect((await chaos({ ErrorCode: 550, Probability: 100 })).ok).toBe(true);
    },
    async reset() {
      expect((await chaos({ ErrorCode: 451, Probability: 0 })).ok).toBe(true);
      expect((await fetch(`${api}/messages`, { method: "DELETE" })).ok).toBe(true);
    },
    async stop() {
      await container.stop();
    },
  };
}

interface ResendRequest {
  method: string;
  path: string;
  authorization: string | undefined;
  contentType: string | undefined;
  body: unknown;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// A local stand-in for https://api.resend.com (UNI-11: no test calls the real API). It answers like Resend's
// `POST /emails`: `{ id }` on success; when told to refuse, 422 with a body that names the recipient and the key, so
// the test can check that neither reaches the error.
async function startResend(): Promise<Harness> {
  const requests: ResendRequest[] = [];
  let refuse = false;
  let next = 0;
  const server: Server = createServer((request, response) => {
    void readBody(request).then((raw) => {
      requests.push({
        method: request.method ?? "",
        path: request.url ?? "",
        authorization: request.headers.authorization,
        contentType: request.headers["content-type"],
        body: JSON.parse(raw) as unknown,
      });
      response.setHeader("Content-Type", "application/json");
      if (refuse) {
        refuse = false;
        response.statusCode = 422;
        response.end(JSON.stringify({ name: "validation_error", message: `Invalid \`to\` ${TO} for ${API_KEY}` }));
        return;
      }
      next += 1;
      response.end(JSON.stringify({ id: `resend-id-${next}` }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    adapter: createEmailAdapter(
      { EMAIL_PROVIDER: "resend", EMAIL_FROM: FROM, RESEND_API_KEY: API_KEY },
      { resendBaseUrl: `http://127.0.0.1:${port}` },
    ),
    async delivered(providerId) {
      expect(requests).toHaveLength(1);
      const [request] = requests;
      expect(request?.method).toBe("POST");
      expect(request?.path).toBe("/emails");
      expect(request?.authorization).toBe(`Bearer ${API_KEY}`);
      expect(request?.contentType).toBe("application/json");
      const body = request?.body as { from: string; to: string[]; subject: string; html: string; text: string };
      expect(Object.keys(body).sort()).toEqual(["from", "html", "subject", "text", "to"]);
      expect(body.to).toEqual([TO]);
      expect(providerId).toBe(`resend-id-${next}`);
      return { from: body.from, to: body.to[0] ?? "", subject: body.subject, html: body.html, text: body.text };
    },
    async refuseNext() {
      refuse = true;
    },
    async reset() {
      requests.length = 0;
      refuse = false;
    },
    async stop() {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

describe.each([
  { provider: "smtp", start: startSmtp, refusedStatus: 550 },
  { provider: "resend", start: startResend, refusedStatus: 422 },
])("email adapter contract: $provider", ({ start, refusedStatus }) => {
  let harness: Harness;
  let message: EmailMessage;

  beforeAll(async () => {
    harness = await start();
    const rendered = await renderTestEmail();
    message = { to: TO, subject: rendered.subject, html: rendered.html, text: rendered.text };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it("sends the rendered test email and returns the provider's id", async () => {
    await harness.reset();
    const { providerId } = await harness.adapter.send(message);
    expect(providerId).not.toBe("");
    const delivered = await harness.delivered(providerId);
    expect(delivered.from).toBe(FROM);
    expect(delivered.to).toBe(TO);
    expect(delivered.subject).toBe(TEST_EMAIL_SUBJECT);
    expect(crlf(delivered.text)).toBe(crlf(message.text));
    expect(crlf(delivered.html)).toBe(crlf(message.html));
    expect(words(delivered.text)).toContain(TEST_EMAIL_BODY);
  });

  // UNI-09: the error reaches job logs and the dead-letter record, so it carries the status only.
  it("throws EmailSendError with the status but not the address or the key when the provider refuses", async () => {
    await harness.reset();
    await harness.refuseNext();
    const error = await harness.adapter.send(message).then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(EmailSendError);
    const text = `${(error as Error).message} ${JSON.stringify(error)} ${String((error as Error).cause ?? "")}`;
    expect((error as EmailSendError).status).toBe(refusedStatus);
    expect((error as Error).message).toContain(String(refusedStatus));
    for (const secret of [TO, "client.example.test", API_KEY, FROM, "crm@mail.example.test"]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("test email template (ASK 8 = A, Charlie 2026-11-01)", () => {
  it("renders the approved subject and body to HTML and plain text", async () => {
    const rendered = await renderTestEmail();
    expect(rendered.subject).toBe("Test email from CRM");
    expect(TEST_EMAIL_BODY).toBe(
      "This is a test email sent from your CRM workspace settings. If you received it, email delivery works.",
    );
    expect(rendered.html).toMatch(/^<!DOCTYPE html/);
    expect(rendered.html).toContain(`<p>${TEST_EMAIL_BODY}</p>`);
    expect(words(rendered.text)).toBe(TEST_EMAIL_BODY);
  });
});
