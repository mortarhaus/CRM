import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { account, invitation, member, twoFactor, user } from "../../db/schema";
import { MIGRATIONS_DIR, startPostgres } from "../../test/postgres";
import { totpFromUri, wrongTotpCode } from "../../test/totp";
import { createAuth, type Auth } from "./config";

const PASSWORD = "correct horse battery staple 42";

let container: StartedPostgreSqlContainer;
let handle: DbHandle;
let auth: Auth;

beforeAll(async () => {
  container = await startPostgres();
  await runMigrations(container.getConnectionUri(), MIGRATIONS_DIR);
  handle = createDb(container.getConnectionUri());
  auth = createAuth({
    db: handle.db,
    secret: "integration test secret, not a real key",
    baseURL: "http://localhost:3000",
  });
});

afterAll(async () => {
  await handle?.sql.end();
  await container?.stop();
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
    return createAuth({ db: handle.db, secret: "integration test secret, not a real key", baseURL });
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

describe("passwords", () => {
  it("stores an Argon2id hash, never scrypt or plaintext", async () => {
    const email = uniqueEmail();
    await signUpAndSignIn(email);
    const { id } = await findUser(email);
    const [credential] = await handle.db.select().from(account).where(eq(account.userId, id));
    expect(credential?.password).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
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
