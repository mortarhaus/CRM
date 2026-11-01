import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { cookies, headers } from "next/headers";
import { getEnv, trustedClientIpHeader } from "../env";
import { handleAuthRequest } from "./handle";

// What Better Auth reads from a request besides the body: the session and 2FA cookies, the origin and Fetch
// Metadata for its CSRF checks. The client IP comes only from the deployment's trusted header, which
// handleAuthRequest turns into the internal client-IP header (spec "Required Phase 1 change to forward.ts").
const FORWARDED_HEADERS = [
  "cookie",
  "origin",
  "referer",
  "user-agent",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
];

export interface AuthResult {
  ok: boolean;
  status: number;
  code: string | undefined;
  data: unknown;
}

function codeOf(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  return typeof data.code === "string" ? data.code : undefined;
}

// Server actions post to Better Auth's HTTP handler instead of calling `auth.api`: the rate limiter
// and origin checks run only in that handler, so the form path gets the same guards as `/api/auth/*`.
export async function postToAuth(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  const incoming = await headers();
  const env = getEnv();
  const trusted = trustedClientIpHeader(env);
  const forwarded = new Headers({ "content-type": "application/json" });
  for (const name of trusted === "none" ? FORWARDED_HEADERS : [...FORWARDED_HEADERS, trusted]) {
    const value = incoming.get(name);
    if (value !== null) forwarded.set(name, value);
  }
  const response = await handleAuthRequest(
    new Request(new URL(`/api/auth${path}`, env.APP_URL), {
      method: "POST",
      headers: forwarded,
      body: JSON.stringify(body),
    }),
  );

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const cookieStore = await cookies();
    for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
      cookieStore.set(name, attributes.value, toCookieOptions(attributes));
    }
  }

  const data: unknown = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, code: codeOf(data), data };
}
