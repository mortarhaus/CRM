import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@crm/core/security";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../../db/client";
import {
  account,
  billingAccount,
  invitation,
  member,
  organization,
  session,
  twoFactor,
  user,
  workspaceSettings,
} from "../../db/schema";
import { ensureWorkspaceSettings } from "../../db/system/workspaces";
import { runInWorkspace } from "../../db/workspace";
import { sqlState, startDatabase, type TestDatabase } from "../../test/postgres";
import { totpFromUri, wrongTotpCode } from "../../test/totp";
import { createAuth, type Auth } from "./config";

const PASSWORD = "correct horse battery staple 42";

let database: TestDatabase;
let handle: DbHandle;
let auth: Auth;
let limiterAdmin: postgres.Sql;
let limiter: DbHandle;

beforeAll(async () => {
  database = await startDatabase();
  limiterAdmin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl);
  limiter = createDb(database.appUrl, { max: 2 });
  auth = createAuth({
    db: handle.db,
    limiterDb: limiter.db,
    secret: "integration test secret, not a real key",
    baseURL: "http://localhost:3000",
  });
});

afterAll(async () => {
  await handle?.sql.end();
  await limiterAdmin?.end();
  await limiter?.sql.end();
  await database?.stop();
});

// The limits are on (spec "Rate limits": tests run with them on) and every request here shares one IP; each test
// starts with no counters, so a test only meets a limit it sets out to reach (rate-limit.test.ts).
beforeEach(async () => {
  await limiterAdmin`delete from rate_limit`;
});

let emailCounter = 0;
function uniqueEmail(): string {
  emailCounter += 1;
  return `user${emailCounter}-${Date.now()}@example.test`;
}

function cookieHeaders(response: Response): Headers {
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
  return new Headers({ cookie });
}

async function signUpAndSignIn(email: string, password = PASSWORD): Promise<Headers> {
  await auth.api.signUpEmail({ body: { name: "Test User", email, password } });
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(response.status).toBe(200);
  return cookieHeaders(response);
}

async function startTotpEnrolment(headers: Headers): Promise<{ totpURI: string; backupCodes: string[] }> {
  const enrolment = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers });
  if (!("totpURI" in enrolment)) throw new Error("expected a TOTP enrolment");
  return enrolment;
}

async function findUser(email: string) {
  const [row] = await handle.db.select().from(user).where(eq(user.email, email));
  if (!row) throw new Error(`no user ${email}`);
  return row;
}

describe("session cookie attributes", () => {
  function authAt(baseURL: string): Auth {
    return createAuth({ db: handle.db, limiterDb: limiter.db, secret: "integration test secret, not a real key", baseURL });
  }

  async function signInCookies(instance: Auth): Promise<string[]> {
    const email = uniqueEmail();
    await instance.api.signUpEmail({ body: { name: "Cookie User", email, password: PASSWORD } });
    const response = await instance.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
    expect(response.status).toBe(200);
    const cookies = response.headers.getSetCookie();
    expect(cookies.some((line) => line.includes("better-auth.session_token="))).toBe(true);
    return cookies;
  }

  it.each(["https://crm.example.test", "http://crm.example.test"])(
    "marks every auth cookie Secure, HttpOnly and SameSite=Lax for the public origin %s",
    async (baseURL) => {
      for (const line of await signInCookies(authAt(baseURL))) {
        expect(line).toMatch(/^__Secure-better-auth\./);
        expect(line).toMatch(/; Secure(;|$)/i);
        expect(line).toMatch(/; HttpOnly(;|$)/i);
        expect(line).toMatch(/; SameSite=Lax(;|$)/i);
      }
    },
  );

  it("keeps loopback http development usable: HttpOnly and SameSite=Lax without the Secure flag", async () => {
    for (const line of await signInCookies(auth)) {
      expect(line).toMatch(/^better-auth\./);
      expect(line).not.toMatch(/; Secure(;|$)/i);
      expect(line).toMatch(/; HttpOnly(;|$)/i);
      expect(line).toMatch(/; SameSite=Lax(;|$)/i);
    }
  });
});

describe("session refresh", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Better Auth 1.7.14 defaults: a session lasts 7 days and is extended once it is a day old.
  it("extends a day-old session on the next session read, as crm_app", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const { id: userId } = await findUser(email);
    const aged = new Date(Date.now() + 5 * DAY_MS);
    await handle.db.update(session).set({ expiresAt: aged }).where(eq(session.userId, userId));

    const refreshed = await auth.api.getSession({ headers });
    expect(new Date(refreshed?.session.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now() + 6 * DAY_MS);
    const [stored] = await handle.db.select().from(session).where(eq(session.userId, userId));
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(aged.getTime());
  });
});

describe("passwords", () => {
  it("stores an Argon2id hash, never scrypt or plaintext", async () => {
    const email = uniqueEmail();
    await signUpAndSignIn(email);
    const { id } = await findUser(email);
    const [credential] = await handle.db.select().from(account).where(eq(account.userId, id));
    expect(credential?.password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });
});

interface Outcome {
  status: number;
  code?: string;
}

function outcomeOf(error: unknown): Outcome {
  const { statusCode, body } = error as { statusCode: number; body?: { code?: string } };
  return { status: statusCode, code: body?.code };
}

async function viaApi(call: () => Promise<unknown>): Promise<Outcome> {
  try {
    await call();
    return { status: 200 };
  } catch (error) {
    return outcomeOf(error);
  }
}

// The HTTP route a crafted request reaches (`/api/auth/*`), not the in-process `auth.api` call.
async function viaHttp(path: string, body: unknown, headers: Headers = new Headers()): Promise<Outcome> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  requestHeaders.set("origin", "http://localhost:3000");
  const response = await auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    }),
  );
  const json = (await response.json().catch(() => null)) as { code?: string } | null;
  return response.ok ? { status: response.status } : { status: response.status, code: json?.code };
}

describe("input limits enforced on the server (owner decision 2026-10-14)", () => {
  const signUpBody = (overrides: { name?: string; password?: string; email?: string }) => ({
    name: "Limit Tester",
    email: uniqueEmail(),
    password: PASSWORD,
    ...overrides,
  });
  const ascii = (length: number) => "p".repeat(length);
  // One code point, two UTF-16 units each.
  const astral = (length: number) => "🔑".repeat(length);

  const signUpPaths = {
    "auth.api": (body: ReturnType<typeof signUpBody>) => viaApi(() => auth.api.signUpEmail({ body })),
    "HTTP POST /api/auth/sign-up/email": (body: ReturnType<typeof signUpBody>) => viaHttp("/sign-up/email", body),
  };

  describe.each(Object.entries(signUpPaths))("sign-up through %s", (_, signUp) => {
    it.each([
      [PASSWORD_MIN_LENGTH - 1, 400, "PASSWORD_TOO_SHORT"],
      [PASSWORD_MIN_LENGTH, 200, undefined],
      [PASSWORD_MAX_LENGTH, 200, undefined],
      [PASSWORD_MAX_LENGTH + 1, 400, "PASSWORD_TOO_LONG"],
    ])("a %i-character password answers %i", async (length, status, code) => {
      expect(await signUp(signUpBody({ password: ascii(length) }))).toEqual({ status, code });
    });

    it.each([
      [PASSWORD_MIN_LENGTH - 1, 400, "PASSWORD_TOO_SHORT"],
      [PASSWORD_MIN_LENGTH, 200, undefined],
      [PASSWORD_MAX_LENGTH, 200, undefined],
      [PASSWORD_MAX_LENGTH + 1, 400, "PASSWORD_TOO_LONG"],
    ])("counts characters, not UTF-16 units: %i emoji answer %i", async (length, status, code) => {
      expect(await signUp(signUpBody({ password: astral(length) }))).toEqual({ status, code });
    });

    it.each([
      [NAME_MAX_LENGTH, 200, undefined],
      [NAME_MAX_LENGTH + 1, 400, "NAME_TOO_LONG"],
    ])("a %i-character name answers %i", async (length, status, code) => {
      expect(await signUp(signUpBody({ name: "n".repeat(length) }))).toEqual({ status, code });
    });

    it("refuses an over-limit name or password the same way whether or not the email exists", async () => {
      const email = uniqueEmail();
      await auth.api.signUpEmail({ body: signUpBody({ email }) });
      for (const overrides of [{ name: "n".repeat(NAME_MAX_LENGTH + 1) }, { password: ascii(PASSWORD_MIN_LENGTH - 1) }]) {
        const existing = await signUp(signUpBody({ ...overrides, email }));
        const fresh = await signUp(signUpBody({ ...overrides, email: uniqueEmail() }));
        expect(existing).toEqual(fresh);
        expect(existing.status).toBe(400);
      }
    });
  });

  it.each([
    [PASSWORD_MIN_LENGTH - 1, 400, "PASSWORD_TOO_SHORT"],
    [PASSWORD_MAX_LENGTH, 200, undefined],
  ])("counts after NFC: a decomposed password of %i composed characters answers %i", async (length, status, code) => {
    // "e" + combining acute: two code points that NFC composes into one "é".
    const password = "é".repeat(length);
    for (const signUp of Object.values(signUpPaths)) {
      expect(await signUp(signUpBody({ password }))).toEqual({ status, code });
    }
  });

  it("hands Better Auth the NFC password, so its UTF-16 maximum does not refuse a valid decomposed one", async () => {
    // 128 Hangul syllables as conjoining jamo: 384 UTF-16 units before NFC, 128 after.
    const password = "한".normalize("NFD").repeat(PASSWORD_MAX_LENGTH);
    expect(password.length).toBe(PASSWORD_MAX_LENGTH * 3);
    for (const signUp of Object.values(signUpPaths)) {
      expect(await signUp(signUpBody({ password }))).toEqual({ status: 200 });
    }
  });

  it("refuses a name over the limit when a signed-in user renames themselves", async () => {
    const headers = await signUpAndSignIn(uniqueEmail());
    expect(await viaHttp("/update-user", { name: "n".repeat(NAME_MAX_LENGTH + 1) }, headers)).toEqual({
      status: 400,
      code: "NAME_TOO_LONG",
    });
    expect(await viaHttp("/update-user", { name: "n".repeat(NAME_MAX_LENGTH) }, headers)).toEqual({ status: 200 });
  });

  it("applies the password limits to a password change", async () => {
    const headers = await signUpAndSignIn(uniqueEmail());
    const change = (newPassword: string) =>
      viaHttp("/change-password", { currentPassword: PASSWORD, newPassword, revokeOtherSessions: true }, headers);
    expect(await change(ascii(PASSWORD_MIN_LENGTH - 1))).toEqual({ status: 400, code: "PASSWORD_TOO_SHORT" });
    expect(await change(astral(PASSWORD_MAX_LENGTH + 1))).toEqual({ status: 400, code: "PASSWORD_TOO_LONG" });
  });

  describe("workspace names", () => {
    const slug = () => `limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    it.each([
      [WORKSPACE_NAME_MAX_LENGTH, 200, undefined],
      [WORKSPACE_NAME_MAX_LENGTH + 1, 400, "WORKSPACE_NAME_TOO_LONG"],
    ])("creating with a %i-character name answers %i, through auth.api and HTTP", async (length, status, code) => {
      const headers = await signUpAndSignIn(uniqueEmail());
      const name = "w".repeat(length);
      expect(await viaApi(() => auth.api.createOrganization({ body: { name, slug: slug() }, headers }))).toEqual({
        status,
        code,
      });
      expect(await viaHttp("/organization/create", { name, slug: slug() }, headers)).toEqual({ status, code });
    });

    it("refuses renaming a workspace past the limit", async () => {
      const headers = await signUpAndSignIn(uniqueEmail());
      const workspace = await auth.api.createOrganization({ body: { name: "Rename Me", slug: slug() }, headers });
      if (!workspace) throw new Error("workspace not created");
      const rename = (name: string) =>
        viaHttp("/organization/update", { organizationId: workspace.id, data: { name } }, headers);
      expect(await rename("w".repeat(WORKSPACE_NAME_MAX_LENGTH + 1))).toEqual({
        status: 400,
        code: "WORKSPACE_NAME_TOO_LONG",
      });
      expect(await rename("w".repeat(WORKSPACE_NAME_MAX_LENGTH))).toEqual({ status: 200 });
    });
  });
});

describe("Unicode passwords (NFC, owner decision 2026-10-14)", () => {
  const COMPOSED = "café crème brûlée";
  const DECOMPOSED = COMPOSED.normalize("NFD");

  it("lets a user who signed up with decomposed accents sign in with composed ones, and back", async () => {
    expect(DECOMPOSED).not.toBe(COMPOSED);
    for (const [signUpWith, signInWith] of [
      [DECOMPOSED, COMPOSED],
      [COMPOSED, DECOMPOSED],
    ] as const) {
      const email = uniqueEmail();
      expect(await viaHttp("/sign-up/email", { name: "Unicode User", email, password: signUpWith })).toEqual({
        status: 200,
      });
      expect(await viaHttp("/sign-in/email", { email, password: signInWith })).toEqual({ status: 200 });
    }
  });
});

describe("sign-up with an email that already has an account", () => {
  it("answers exactly like a fresh sign-up, creates nothing and keeps the original password", async () => {
    const email = uniqueEmail();
    const first = await auth.api.signUpEmail({ body: { name: "Original", email, password: "original-password-123" } });
    const second = await auth.api.signUpEmail({ body: { name: "Impostor", email, password: "impostor-password-456" } });

    expect(first.token).toBeNull();
    expect(second.token).toBeNull();
    expect(Object.keys(second.user).sort()).toEqual(Object.keys(first.user).sort());

    const rows = await handle.db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Original");

    await expect(
      auth.api.signInEmail({ body: { email, password: "impostor-password-456" } }),
    ).rejects.toMatchObject({ statusCode: 401 });
    const original = await auth.api.signInEmail({
      body: { email, password: "original-password-123" },
      asResponse: true,
    });
    expect(original.status).toBe(200);
  });
});

describe("TOTP enrolment", () => {
  it("rejects a wrong code and leaves 2FA off, then accepts the right code", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const enrolment = await startTotpEnrolment(headers);
    expect(enrolment.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(enrolment.backupCodes).toHaveLength(10);
    const totp = totpFromUri(enrolment.totpURI);

    await expect(
      auth.api.verifyTOTP({ body: { code: wrongTotpCode(totp) }, headers }),
    ).rejects.toMatchObject({ statusCode: 401 });

    const afterWrong = await findUser(email);
    expect(afterWrong.twoFactorEnabled ?? false).toBe(false);
    const [pending] = await handle.db.select().from(twoFactor).where(eq(twoFactor.userId, afterWrong.id));
    expect(pending?.verified).toBe(false);

    await auth.api.verifyTOTP({ body: { code: totp.generate() }, headers });
    expect((await findUser(email)).twoFactorEnabled).toBe(true);
  });

  it("lets a recovery code finish a 2FA sign-in exactly once", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const enrolment = await startTotpEnrolment(headers);
    await auth.api.verifyTOTP({ body: { code: totpFromUri(enrolment.totpURI).generate() }, headers });
    const recoveryCode = enrolment.backupCodes[0];
    if (!recoveryCode) throw new Error("no recovery codes returned");

    async function startTwoFactorSignIn(): Promise<Headers> {
      const response = await auth.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true });
      const body = (await response.clone().json()) as { twoFactorRedirect?: boolean };
      expect(body.twoFactorRedirect).toBe(true);
      return cookieHeaders(response);
    }

    const firstUse = await auth.api.verifyBackupCode({
      body: { code: recoveryCode },
      headers: await startTwoFactorSignIn(),
      asResponse: true,
    });
    expect(firstUse.status).toBe(200);

    await expect(
      auth.api.verifyBackupCode({ body: { code: recoveryCode }, headers: await startTwoFactorSignIn() }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("TOTP enrolment restart and turning 2FA off", () => {
  it("replaces the unconfirmed secret when enrolment starts again, and only the new one confirms", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const first = totpFromUri((await startTotpEnrolment(headers)).totpURI);
    const second = totpFromUri((await startTotpEnrolment(headers)).totpURI);
    expect(second.secret.base32).not.toBe(first.secret.base32);

    await auth.api.verifyTOTP({ body: { code: second.generate() }, headers });
    expect((await findUser(email)).twoFactorEnabled).toBe(true);
  });

  it("turns 2FA off with the password and removes the stored secret", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const enrolment = await startTotpEnrolment(headers);
    const verified = await auth.api.verifyTOTP({
      body: { code: totpFromUri(enrolment.totpURI).generate() },
      headers,
      asResponse: true,
    });
    const signedIn = cookieHeaders(verified);

    await auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers: signedIn });
    const { id, twoFactorEnabled } = await findUser(email);
    expect(twoFactorEnabled).toBe(false);
    expect(await handle.db.select().from(twoFactor).where(eq(twoFactor.userId, id))).toEqual([]);
  });
});

describe("switching workspace", () => {
  it("refuses a workspace the user is not a member of and never points the session at it", async () => {
    const ownerHeaders = await signUpAndSignIn(uniqueEmail());
    const outsiderHeaders = await signUpAndSignIn(uniqueEmail());
    const workspace = await auth.api.createOrganization({
      body: { name: "Owner Studio", slug: `owner-studio-${Date.now()}` },
      headers: ownerHeaders,
    });
    if (!workspace) throw new Error("workspace not created");

    await expect(
      auth.api.setActiveOrganization({ body: { organizationId: workspace.id }, headers: outsiderHeaders }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const outsiderSession = await auth.api.getSession({ headers: outsiderHeaders });
    expect(outsiderSession?.session.activeOrganizationId ?? null).toBeNull();

    const switched = await auth.api.setActiveOrganization({
      body: { organizationId: workspace.id },
      headers: ownerHeaders,
    });
    expect(switched?.id).toBe(workspace.id);
  });
});

describe("workspace settings", () => {
  it("gives every new workspace its own workspace_settings row at version 1", async () => {
    const headers = await signUpAndSignIn(uniqueEmail());
    const workspaceIds: string[] = [];
    for (const name of ["First Studio", "Second Studio"]) {
      const workspace = await auth.api.createOrganization({
        body: { name, slug: `${name.toLowerCase().replace(" ", "-")}-${Date.now()}` },
        headers,
      });
      if (!workspace) throw new Error("workspace not created");
      workspaceIds.push(workspace.id);
    }
    for (const workspaceId of workspaceIds) {
      const rows = await runInWorkspace(handle.db, workspaceId, (tx) => tx.select().from(workspaceSettings));
      expect(rows).toEqual([expect.objectContaining({ workspaceId, version: 1 })]);
    }
  });

  it("heals a workspace whose row is missing, and a second call changes nothing (plan Risk 6)", async () => {
    const [workspace] = await handle.db
      .insert(organization)
      .values({ name: "Half Created", slug: `half-created-${Date.now()}`, createdAt: new Date() })
      .returning({ id: organization.id });
    if (!workspace) throw new Error("workspace not created");
    const read = () => runInWorkspace(handle.db, workspace.id, (tx) => tx.select().from(workspaceSettings));
    expect(await read()).toEqual([]);

    await ensureWorkspaceSettings(handle.db, workspace.id);
    const [healed] = await read();
    await ensureWorkspaceSettings(handle.db, workspace.id);
    expect(await read()).toEqual([healed]);
    expect(healed).toMatchObject({ workspaceId: workspace.id, version: 1 });
  });
});

describe("billing accounts", () => {
  const slug = () => `billing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function createWorkspace(headers: Headers, body: Record<string, unknown> = {}) {
    const workspace = await auth.api.createOrganization({ body: { name: "Billing Studio", slug: slug(), ...body }, headers });
    if (!workspace) throw new Error("workspace not created");
    const [row] = await handle.db.select().from(organization).where(eq(organization.id, workspace.id));
    return row;
  }

  it("gives a user's first workspace a free billing account they own, and reuses it for the second", async () => {
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const owner = await findUser(email);
    const first = await createWorkspace(headers);
    const second = await createWorkspace(headers);

    const accounts = await handle.db.select().from(billingAccount).where(eq(billingAccount.ownerUserId, owner.id));
    expect(accounts).toEqual([
      expect.objectContaining({ ownerUserId: owner.id, name: owner.name, plan: "free", status: "active", stripeCustomerId: null, limits: {} }),
    ]);
    expect(first?.billingAccountId).toBe(accounts[0]?.id);
    expect(second?.billingAccountId).toBe(accounts[0]?.id);
  });

  it("never takes the billing account from the request, on create or on update", async () => {
    const otherHeaders = await signUpAndSignIn(uniqueEmail());
    const other = await createWorkspace(otherHeaders);
    const email = uniqueEmail();
    const headers = await signUpAndSignIn(email);
    const owner = await findUser(email);

    const created = await createWorkspace(headers, { billingAccountId: other?.billingAccountId });
    const [own] = await handle.db.select().from(billingAccount).where(eq(billingAccount.ownerUserId, owner.id));
    expect(created?.billingAccountId).toBe(own?.id);
    expect(created?.billingAccountId).not.toBe(other?.billingAccountId);

    if (!created) throw new Error("workspace not created");
    await viaHttp(
      "/organization/update",
      { organizationId: created.id, data: { name: "Renamed", billingAccountId: other?.billingAccountId } },
      headers,
    );
    const [after] = await handle.db.select().from(organization).where(eq(organization.id, created.id));
    expect(after?.billingAccountId).toBe(own?.id);
  });

  it("refuses any plan but free and any status but active (locked switch; ASK 5)", async () => {
    const email = uniqueEmail();
    await signUpAndSignIn(email);
    const { id: ownerUserId } = await findUser(email);
    const admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
    try {
      const rows: ReadonlyArray<readonly [plan: string, status: string]> = [
        ["pro", "active"],
        ["free", "suspended"],
      ];
      for (const [plan, status] of rows) {
        expect(
          await sqlState(admin`insert into billing_account (owner_user_id, name, plan, status) values (${ownerUserId}, 'x', ${plan}, ${status})`),
        ).toBe("23514");
      }
    } finally {
      await admin.end();
    }
  });
});

describe("workspace invitations", () => {
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  const TOLERANCE_MS = 60 * 1000;

  function expectAboutThirtyMinutesAhead(expiresAt: Date | string): void {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(THIRTY_MINUTES_MS - TOLERANCE_MS);
    expect(remaining).toBeLessThanOrEqual(THIRTY_MINUTES_MS);
  }

  async function setInvitationExpiry(invitationId: string, expiresAt: Date): Promise<void> {
    await handle.db.update(invitation).set({ expiresAt }).where(eq(invitation.id, invitationId));
  }

  async function inviteToNewWorkspace() {
    const ownerHeaders = await signUpAndSignIn(uniqueEmail());
    const workspace = await auth.api.createOrganization({
      body: { name: "Inviting Studio", slug: `inviting-studio-${Date.now()}-${emailCounter}` },
      headers: ownerHeaders,
    });
    if (!workspace) throw new Error("workspace not created");
    const inviteeEmail = uniqueEmail();
    const invite = await auth.api.createInvitation({
      body: { email: inviteeEmail, role: "member", organizationId: workspace.id },
      headers: ownerHeaders,
    });
    return { ownerHeaders, workspace, inviteeEmail, invite };
  }

  it("expires a new invitation 30 minutes after it is created", async () => {
    const { invite } = await inviteToNewWorkspace();
    expectAboutThirtyMinutesAhead(invite.expiresAt);
    const [stored] = await handle.db.select().from(invitation).where(eq(invitation.id, invite.id));
    if (!stored) throw new Error("invitation not stored");
    expectAboutThirtyMinutesAhead(stored.expiresAt);
  });

  it("refuses an expired invitation, and the same invitation is accepted once inside the window", async () => {
    const { workspace, inviteeEmail, invite } = await inviteToNewWorkspace();
    const inviteeHeaders = await signUpAndSignIn(inviteeEmail);

    await setInvitationExpiry(invite.id, new Date(Date.now() - 1000));
    await expect(
      auth.api.acceptInvitation({ body: { invitationId: invite.id }, headers: inviteeHeaders }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const invitee = await findUser(inviteeEmail);
    const membershipAfterExpiry = await handle.db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, workspace.id), eq(member.userId, invitee.id)));
    expect(membershipAfterExpiry).toHaveLength(0);

    await setInvitationExpiry(invite.id, new Date(Date.now() + 60_000));
    const accepted = await auth.api.acceptInvitation({ body: { invitationId: invite.id }, headers: inviteeHeaders });
    expect(accepted?.member.userId).toBe(invitee.id);
  });

  it("gives a resent invitation a fresh 30-minute expiry", async () => {
    const { ownerHeaders, workspace, inviteeEmail, invite } = await inviteToNewWorkspace();
    await setInvitationExpiry(invite.id, new Date(Date.now() + 60_000));

    const resent = await auth.api.createInvitation({
      body: { email: inviteeEmail, role: "member", organizationId: workspace.id, resend: true },
      headers: ownerHeaders,
    });
    expect(resent.id).toBe(invite.id);
    expectAboutThirtyMinutesAhead(resent.expiresAt);
    const [stored] = await handle.db.select().from(invitation).where(eq(invitation.id, invite.id));
    if (!stored) throw new Error("invitation not stored");
    expectAboutThirtyMinutesAhead(stored.expiresAt);
  });
});
