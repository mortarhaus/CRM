import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../../db/client";
import { runMigrations } from "../../db/migrate";
import { account, twoFactor, user } from "../../db/schema";
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
