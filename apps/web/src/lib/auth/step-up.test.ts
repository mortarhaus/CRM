import { STEP_UP_WINDOW_SECONDS } from "@crm/core/security";
import type { TOTP } from "otpauth";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createDb, type DbHandle } from "../../db/client";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { totpFromUri, wrongTotpCode } from "../../test/totp";
import { type Auth, createAuth } from "./config";

// Phase 2 plan Task 13: step-up against a real Better Auth instance on the real crm_app role. The code check posts to
// Better Auth's own handler (postToAuth), so its per-IP limit, origin check and TOTP verify all really run.
const PASSWORD = "correct horse battery staple 42";
const ORIGIN = "http://localhost:3000";
const SECRET = "integration test secret, not a real key";

let requestHeaders = new Headers();
const setCookie = vi.fn();
let handle: DbHandle;
let limiter: DbHandle;
let auth: Auth;

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: setCookie }),
}));
vi.mock("../../db/index", () => ({ getDb: () => handle, getLimiterDb: () => limiter }));
vi.mock("./server", () => ({ getAuth: () => auth, getAuthHandler: () => (request: Request) => auth.handler(request) }));
vi.mock("../env", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEnv: () => ({ APP_URL: ORIGIN, TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for", AUTH_SECRET: SECRET }),
}));

const { action } = await import("./action");
const { requireStepUp, verifyStepUp } = await import("./step-up");

let database: TestDatabase;
let admin: postgres.Sql;
let counter = 0;

interface Session {
  cookie: string;
  id: string;
}

interface Party {
  userId: string;
  workspaceId: string;
  // The session that enrolled (Better Auth's replacement for it) and a second sign-in after enrolment.
  first: Session;
  second: Session;
  totp: TOTP | null;
}

function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
}

async function signIn(email: string): Promise<string> {
  const response = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
  expect(response.status).toBe(200);
  return cookieOf(response);
}

async function sessionOf(cookie: string): Promise<Session> {
  const current = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!current) throw new Error("no session for cookie");
  return { cookie, id: current.session.id };
}

// A user who created a workspace (its owner), with two live sessions, and with TOTP enrolled unless `enrol` is false.
async function newParty(label: string, enrol = true): Promise<Party> {
  counter += 1;
  const email = `${label}-${counter}-${Date.now()}@example.test`;
  await auth.api.signUpEmail({ body: { name: `${label} user`, email, password: PASSWORD } });
  let cookie = await signIn(email);
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/organization/create`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ name: `${label} studio`, slug: `${label}-${counter}-${Date.now()}` }),
    }),
  );
  expect(response.status).toBe(200);
  const { id: workspaceId } = (await response.json()) as { id: string };
  let totp: TOTP | null = null;
  if (enrol) {
    const headers = new Headers({ cookie });
    const enrolment = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
    if (!("totpURI" in enrolment)) throw new Error("expected a TOTP enrolment");
    totp = totpFromUri(enrolment.totpURI);
    const verified = await auth.api.verifyTOTP({ body: { code: totp.generate() }, headers, asResponse: true });
    expect(verified.status).toBe(200);
    cookie = cookieOf(verified);
  }
  const [row] = await admin<{ id: string }[]>`select id from "user" where email = ${email}`;
  if (!row) throw new Error("user not created");
  // Enabling 2FA ends every session of the user (migration 0009), so the second session signs in after it, through
  // the 2FA challenge when enrolled.
  let secondCookie = await signIn(email);
  if (totp) {
    const challenge = new Headers({ cookie: secondCookie });
    const passed = await auth.api.verifyTOTP({ body: { code: totp.generate() }, headers: challenge, asResponse: true });
    expect(passed.status).toBe(200);
    secondCookie = cookieOf(passed);
  }
  await admin`update session set active_organization_id = ${workspaceId} where user_id = ${row.id}`;
  return { userId: row.id, workspaceId, first: await sessionOf(cookie), second: await sessionOf(secondCookie), totp };
}

function signedInAs(session: Session, ip = "203.0.113.7"): void {
  requestHeaders = new Headers({ cookie: session.cookie, origin: ORIGIN, "x-forwarded-for": ip });
}

// The code the authenticator shows `steps` periods from now; Better Auth accepts -1, 0 and +1.
function codeAt(totp: TOTP | null, steps = 0): string {
  if (!totp) throw new Error("party has no TOTP");
  return totp.generate({ timestamp: Date.now() + steps * totp.period * 1000 });
}

// A high-risk action as Phase 2 PR 5b will write one: the handler asks for step-up first.
const highRisk = action({
  name: "test.highRisk",
  minRole: "staff",
  input: z.object({}),
  idempotent: false,
  handler: async (ctx) => {
    await requireStepUp(ctx.tx, { id: ctx.sessionId });
    return { done: true };
  },
});

async function sessionCount(userId: string): Promise<number> {
  const [row] = await admin<{ n: number }[]>`select count(*)::int as n from session where user_id = ${userId}`;
  return row?.n ?? 0;
}

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl, { max: 4 });
  limiter = createDb(database.appUrl, { max: 2 });
  auth = createAuth({ db: handle.db, limiterDb: limiter.db, secret: SECRET, baseURL: ORIGIN });
});

afterAll(async () => {
  await handle?.sql.end();
  await limiter?.sql.end();
  await admin?.end();
  await database?.stop();
});

beforeEach(async () => {
  // Every test starts with fresh counters, Better Auth's per-IP rows included.
  await admin`delete from rate_limit`;
  setCookie.mockClear();
});

describe("requireStepUp", () => {
  it("refuses STEP_UP_REQUIRED when the session never stepped up", async () => {
    const party = await newParty("none");
    signedInAs(party.first);
    expect(await highRisk({})).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
  });

  it("allows the session that stepped up, and refuses it once the verification is 301 s old", async () => {
    const party = await newParty("window");
    signedInAs(party.first);
    expect(await verifyStepUp({ code: codeAt(party.totp) })).toEqual({ ok: true, status: "DONE", data: { verified: true } });
    expect(await highRisk({})).toEqual({ ok: true, status: "DONE", data: { done: true } });

    const age = async (seconds: number) =>
      admin`update step_up set verified_at = now() - make_interval(secs => ${seconds}) where session_id = ${party.first.id}`;
    await age(STEP_UP_WINDOW_SECONDS - 1);
    expect((await highRisk({})).ok).toBe(true);
    await age(STEP_UP_WINDOW_SECONDS + 1);
    expect(await highRisk({})).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
  });

  it("refuses another session of the same user, and the same session in another workspace", async () => {
    const party = await newParty("bound");
    signedInAs(party.first);
    expect((await verifyStepUp({ code: codeAt(party.totp) })).ok).toBe(true);

    signedInAs(party.second);
    expect(await highRisk({})).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });

    // The user's second workspace: the first session's step-up was for the first workspace only.
    const response = await auth.handler(
      new Request(`${ORIGIN}/api/auth/organization/create`, {
        method: "POST",
        headers: { cookie: party.first.cookie, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ name: "second studio", slug: `second-${counter}-${Date.now()}` }),
      }),
    );
    expect(response.status).toBe(200);
    const { id: secondWorkspace } = (await response.json()) as { id: string };
    await admin`update session set active_organization_id = ${secondWorkspace} where id = ${party.first.id}`;
    signedInAs(party.first);
    expect(await highRisk({})).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
    const rows = await admin<{ workspace_id: string }[]>`select workspace_id from step_up where session_id = ${party.first.id}`;
    expect(rows).toEqual([{ workspace_id: party.workspaceId }]);
  });
});

describe("verifyStepUp", () => {
  it("issues, rotates and ends no session, and binds the row to the calling session", async () => {
    const party = await newParty("nosession");
    const before = await sessionCount(party.userId);
    signedInAs(party.first);
    expect((await verifyStepUp({ code: codeAt(party.totp) })).ok).toBe(true);
    expect(await sessionCount(party.userId)).toBe(before);
    expect(setCookie).not.toHaveBeenCalled();
    expect((await auth.api.getSession({ headers: new Headers({ cookie: party.first.cookie }) }))?.session.id).toBe(
      party.first.id,
    );
    const rows = await admin<{ session_id: string; workspace_id: string }[]>`
      select session_id, workspace_id from step_up where workspace_id = ${party.workspaceId}`;
    expect(rows).toEqual([{ session_id: party.first.id, workspace_id: party.workspaceId }]);
    const [audit] = await admin<{ action: string; target_id: string }[]>`
      select action, target_id from audit_log where workspace_id = ${party.workspaceId} and action = 'auth.step_up'`;
    expect(audit).toEqual({ action: "auth.step_up", target_id: party.first.id });
  });

  it("refuses a wrong code with WRONG_CODE and records nothing", async () => {
    const party = await newParty("wrong");
    if (!party.totp) throw new Error("no TOTP");
    signedInAs(party.first);
    expect(await verifyStepUp({ code: wrongTotpCode(party.totp) })).toEqual({ ok: false, status: "WRONG_CODE" });
    expect(await admin`select 1 from step_up where session_id = ${party.first.id}`).toHaveLength(0);
  });

  it("refuses input that is not six digits before any check", async () => {
    const party = await newParty("shape");
    signedInAs(party.first);
    expect(await verifyStepUp({ code: "12345" })).toEqual({ ok: false, status: "INVALID_INPUT", fields: ["code"] });
    expect(await admin`select 1 from rate_limit where key like 'step-up:%'`).toHaveLength(0);
  });

  it("refuses a user without 2FA with TWO_FACTOR_REQUIRED (enrol first), before any code check", async () => {
    const party = await newParty("unenrolled", false);
    signedInAs(party.first);
    expect(await verifyStepUp({ code: "123456" })).toEqual({ ok: false, status: "TWO_FACTOR_REQUIRED" });
    expect(await admin`select key from rate_limit where key like 'step-up:%' or key like 'ba:two-factor-verify:%'`).toHaveLength(0);
    expect(await highRisk({})).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
  });

  it("refuses one code twice: in the same session, in another session, and in another workspace", async () => {
    const party = await newParty("replay");
    const code = codeAt(party.totp);
    signedInAs(party.first);
    expect((await verifyStepUp({ code })).ok).toBe(true);
    expect(await verifyStepUp({ code })).toEqual({ ok: false, status: "WRONG_CODE" });
    signedInAs(party.second);
    expect(await verifyStepUp({ code })).toEqual({ ok: false, status: "WRONG_CODE" });
    expect(await highRisk({})).toEqual({ ok: false, status: "STEP_UP_REQUIRED" });
    // The next code still works for the second session.
    expect((await verifyStepUp({ code: codeAt(party.totp, 1) })).ok).toBe(true);
    expect((await highRisk({})).ok).toBe(true);
    // The marker holds an HMAC of the code, never the code.
    const keys = await admin<{ key: string }[]>`select key from rate_limit where key like 'step-up:code:%'`;
    expect(keys).toHaveLength(2);
    for (const { key } of keys) expect(key).not.toContain(code);
  });

  it("gives RATE_LIMITED on the 11th check of one user in 60 s, even from a new IP address each time", async () => {
    const party = await newParty("limit");
    if (!party.totp) throw new Error("no TOTP");
    const wrong = wrongTotpCode(party.totp);
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      signedInAs(party.first, `203.0.113.${attempt}`);
      expect(await verifyStepUp({ code: wrong })).toEqual({ ok: false, status: "WRONG_CODE" });
    }
    signedInAs(party.first, "203.0.113.99");
    expect(await verifyStepUp({ code: codeAt(party.totp) })).toEqual({ ok: false, status: "RATE_LIMITED" });
    // Another session of the same user is limited too.
    signedInAs(party.second, "198.51.100.1");
    expect(await verifyStepUp({ code: codeAt(party.totp) })).toEqual({ ok: false, status: "RATE_LIMITED" });
    expect(await admin`select 1 from step_up where workspace_id = ${party.workspaceId}`).toHaveLength(0);
  });

  it("gives RATE_LIMITED when Better Auth's two-factor-verify row for the IP is spent", async () => {
    const party = await newParty("iplimit");
    // The per-IP row is Better Auth's (ba:two-factor-verify:<ip>), consumed by the post itself.
    await admin`
      insert into rate_limit (key, count, window_start, window_seconds)
      values ('ba:two-factor-verify:203.0.113.50', 10, clock_timestamp(), 60)`;
    signedInAs(party.first, "203.0.113.50");
    expect(await verifyStepUp({ code: codeAt(party.totp) })).toEqual({ ok: false, status: "RATE_LIMITED" });
    expect(await admin`select 1 from step_up where session_id = ${party.first.id}`).toHaveLength(0);
  });
});

describe("require_2fa (ASK 9)", () => {
  async function requireTwoFactor(workspaceId: string, value: boolean): Promise<void> {
    await admin`update workspace_settings set require_2fa = ${value} where workspace_id = ${workspaceId}`;
  }
  async function setRole(party: Party, role: string): Promise<void> {
    await admin`update member set "role" = ${role} where user_id = ${party.userId} and organization_id = ${party.workspaceId}`;
  }
  const plain = action({ name: "test.plain", minRole: "staff", input: z.object({}), idempotent: false, handler: async () => ({ done: true }) });

  it("refuses an Owner or Admin without 2FA with TWO_FACTOR_REQUIRED only while the workspace requires it", async () => {
    const party = await newParty("req", false);
    signedInAs(party.first);
    expect((await plain({})).ok).toBe(true);
    await requireTwoFactor(party.workspaceId, true);
    expect(await plain({})).toEqual({ ok: false, status: "TWO_FACTOR_REQUIRED" });
    await setRole(party, "admin");
    expect(await plain({})).toEqual({ ok: false, status: "TWO_FACTOR_REQUIRED" });
    await setRole(party, "staff");
    expect(await plain({})).toEqual({ ok: true, status: "DONE", data: { done: true } });
    await setRole(party, "owner");
    await requireTwoFactor(party.workspaceId, false);
    expect((await plain({})).ok).toBe(true);
  });

  it("lets an Owner with 2FA act in a workspace that requires it", async () => {
    const party = await newParty("req2fa");
    await requireTwoFactor(party.workspaceId, true);
    signedInAs(party.first);
    expect((await plain({})).ok).toBe(true);
  });
});
