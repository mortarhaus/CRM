import { createHmac, hkdfSync } from "node:crypto";
import { AUTH_DEFAULT_LIMIT, SIGN_IN_ACCOUNT_FAILURE_LIMIT } from "@crm/core/security";
import { consume, giveBack } from "../../db/system";

// The limiter pool, typed through the system module (TEN-10: no db/client import here).
type Database = Parameters<typeof consume>[0];

// What every request to Better Auth's HTTP handler passes through after its client IP is set (handle.ts; plan
// Task 23): the per-account sign-in limit and the one 429.

const AUTH_BASE_PATH = "/api/auth";
const SIGN_IN_PATH = `${AUTH_BASE_PATH}/sign-in/email`;

// Spec "Rate limits": every 429 reads the same, whichever limit refused and whether or not the email has an account.
export const TOO_MANY_REQUESTS_BODY = JSON.stringify({ message: "Too many requests. Please try again later." });
// A 429 whose source gave no usable retry time (the two-factor lockout sends none) tells the client to wait one
// default window. DECISIONS "Phase 1 PR 7".
export const FALLBACK_RETRY_AFTER_SECONDS = AUTH_DEFAULT_LIMIT.windowSeconds;

export function tooManyRequests(retryAfterSeconds: number): Response {
  const seconds = String(retryAfterSeconds);
  return new Response(TOO_MANY_REQUESTS_BODY, {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": seconds,
      "X-Retry-After": seconds,
    },
  });
}

function retryAfterOf(response: Response): number {
  const value = Number(response.headers.get("x-retry-after") ?? response.headers.get("retry-after"));
  return Number.isInteger(value) && value > 0 ? value : FALLBACK_RETRY_AFTER_SECONDS;
}

// The account key's HMAC key, derived from AUTH_SECRET under its own label: the key never reveals the email, and
// rotating AUTH_SECRET resets every account counter (runbook).
const ACCOUNT_KEY_INFO = "crm:rate-limit-key:v1";

export function accountKeyHmacKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", ACCOUNT_KEY_INFO, 32));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().normalize("NFC");
}

export function accountKeyOf(hmacKey: Buffer, email: string): string {
  return `acct:signin:${createHmac("sha256", hmacKey).update(normalizeEmail(email)).digest("base64url")}`;
}

// The sign-in body's email, or null when the body is not JSON with a string email (Better Auth answers 400 as before).
async function signInEmailOf(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.clone().json();
    if (typeof body !== "object" || body === null) return null;
    const { email } = body as { email?: unknown };
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}

export interface AuthRequestHandlerDeps {
  handler(request: Request): Promise<Response>;
  // The limiter's own pool (getLimiterDb): each consume and give-back autocommits.
  limiterDb: Database;
  secret: string;
}

export function authRequestHandler({ handler, limiterDb, secret }: AuthRequestHandlerDeps) {
  const hmacKey = accountKeyHmacKey(secret);

  // Spec "Rate limits", sign-in failures per account: 5 per 15 minutes, an unknown email counted like a known one.
  // The unit is taken before Better Auth runs, so concurrent failures cannot pass the cap, and given back when the
  // sign-in succeeds: any 2xx, which is a session or the two-factor challenge (`{ twoFactorRedirect: true }` with
  // 200, Better Auth 1.7.14 plugins/two-factor/index.mjs:328).
  async function signIn(request: Request): Promise<Response> {
    const email = await signInEmailOf(request);
    if (email === null) return handler(request);
    const key = accountKeyOf(hmacKey, email);
    const { max, windowSeconds } = SIGN_IN_ACCOUNT_FAILURE_LIMIT;
    const unit = await consume(limiterDb, key, max, windowSeconds, null);
    if (!unit.allowed) return tooManyRequests(unit.retryAfterSeconds);
    const response = await handler(request);
    if (response.ok) await giveBack(limiterDb, key, unit.windowStart);
    return response;
  }

  return async function handle(request: Request): Promise<Response> {
    const isSignIn = request.method === "POST" && new URL(request.url).pathname === SIGN_IN_PATH;
    const response = await (isSignIn ? signIn(request) : handler(request));
    return response.status === 429 ? tooManyRequests(retryAfterOf(response)) : response;
  };
}
