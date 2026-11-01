import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "@crm/core/security";
import type { TOTP } from "otpauth";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AuthLike,
  bodyField,
  call,
  CookieJar,
  failOnce,
  holdAt,
  lockWaiters,
  PASSWORD,
  type Reply,
  SECRET,
  sessionTokens,
  setsSession,
  userIdOf,
  waitUntil,
} from "../../test/auth-harness";
import {
  buildWeb,
  EDGE_BACKEND_HEADER,
  EDGE_PEER_HEADER,
  type NextServer,
  startEdge,
  startNext,
  type TestEdge,
} from "../../test/next-server";
import { startDatabase, type TestDatabase } from "../../test/postgres";
import { totpFromUri } from "../../test/totp";
import { authOptions } from "./config";
import { endpointPathsOf, PHASE1_ENABLED_AUTH_PATHS } from "./enabled-paths";
import { PASSWORD_CHECK_PATHS } from "./rate-limit-rules";

// Plan Task 24 Steps 1 and 2. The snapshot is every endpoint path of the installed Better Auth (1.7.14) with this
// app's plugins: an upgrade that adds or renames one fails here until it is classified in enabled-paths.ts.
const ALL_PATHS_1_7_14 = [
  "/account-info",
  "/callback/:id",
  "/change-email",
  "/change-password",
  "/delete-user",
  "/delete-user/callback",
  "/error",
  "/get-access-token",
  "/get-session",
  "/link-social",
  "/list-accounts",
  "/list-sessions",
  "/ok",
  "/organization/accept-invitation",
  "/organization/cancel-invitation",
  "/organization/check-slug",
  "/organization/create",
  "/organization/delete",
  "/organization/get-active-member",
  "/organization/get-active-member-role",
  "/organization/get-full-organization",
  "/organization/get-invitation",
  "/organization/get-organization",
  "/organization/has-permission",
  "/organization/invite-member",
  "/organization/leave",
  "/organization/list",
  "/organization/list-invitations",
  "/organization/list-members",
  "/organization/list-user-invitations",
  "/organization/reject-invitation",
  "/organization/remove-member",
  "/organization/set-active",
  "/organization/update",
  "/organization/update-member-role",
  "/refresh-token",
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/sign-up/email",
  "/two-factor/disable",
  "/two-factor/enable",
  "/two-factor/generate-backup-codes",
  "/two-factor/get-totp-uri",
  "/two-factor/send-otp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
  "/two-factor/verify-totp",
  "/unlink-account",
  "/update-session",
  "/update-user",
  "/verify-email",
  "/verify-password",
];

const options = authOptions({ db: {} as never, secret: SECRET, baseURL: "http://localhost:3000" });

describe("the Phase 1 path list", () => {
  it("snapshot: the installed version exposes exactly these paths", () => {
    expect(endpointPathsOf(options)).toEqual(ALL_PATHS_1_7_14);
  });

  it("every enabled path exists, and every other one is in disabledPaths", () => {
    const all = new Set(ALL_PATHS_1_7_14);
    for (const path of PHASE1_ENABLED_AUTH_PATHS) expect(all.has(path), path).toBe(true);
    const enabled = new Set<string>(PHASE1_ENABLED_AUTH_PATHS);
    expect([...options.disabledPaths].sort()).toEqual(ALL_PATHS_1_7_14.filter((path) => !enabled.has(path)));
  });

  it("every password-check row path is enabled, and every enabled path whose body takes a password is on that row", () => {
    const enabled = new Set<string>(PHASE1_ENABLED_AUTH_PATHS);
    for (const path of PASSWORD_CHECK_PATHS) expect(enabled.has(path), path).toBe(true);
    const withPassword = ["/change-password", "/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes"];
    expect([...PASSWORD_CHECK_PATHS].sort()).toEqual(withPassword.sort());
  });
});

// The built app, one `next start` process behind a test edge (x-forwarded-for), on this file's own database. Each
// request comes from its own edge address, so the per-IP limits stay out of the way.
describe("through next start", () => {
  let database: TestDatabase;
  let admin: postgres.Sql;
  let edge: TestEdge;
  let server: NextServer;
  let auth: AuthLike;
  let peers = 0;

  beforeAll(async () => {
    await buildWeb();
    database = await startDatabase();
    admin = postgres(database.adminUrl, { max: 4, onnotice: () => {} });
    edge = await startEdge("x-forwarded-for", []);
    server = await startNext({
      DATABASE_URL: database.appUrl,
      DATABASE_MIGRATOR_URL: database.migratorUrl,
      AUTH_SECRET: SECRET,
      APP_URL: edge.origin,
      DEPLOYMENT_MODE: "selfhost",
      TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for",
    });
    edge.backends.push(server);
    // The harness's requests (auth-harness `call`), sent over HTTP to the edge instead of to an in-process handler.
    auth = {
      $context: Promise.resolve({}),
      async handler(request) {
        const url = new URL(request.url);
        const headers = new Headers(request.headers);
        headers.set("origin", edge.origin);
        peers += 1;
        headers.set(EDGE_PEER_HEADER, `10.${Math.floor(peers / 250) % 250}.${peers % 250}.1`);
        headers.set(EDGE_BACKEND_HEADER, "0");
        const body = request.method === "GET" ? undefined : await request.text();
        return fetch(`${edge.origin}${url.pathname}${url.search}`, { method: request.method, headers, body, redirect: "manual" });
      },
    };
  }, 300_000);

  afterAll(async () => {
    await server?.stop();
    await edge?.close();
    await admin?.end();
    await database?.stop();
  });

  let emails = 0;
  const newEmail = () => `paths${(emails += 1)}-${Date.now()}@example.test`;
  const http = (method: "GET" | "POST", path: string, options: { body?: unknown; jar?: CookieJar } = {}) =>
    call(auth, method, path, options);

  async function signUp(email = newEmail()): Promise<{ email: string; id: string }> {
    expect((await http("POST", "/sign-up/email", { body: { name: "Path Person", email, password: PASSWORD } })).status).toBe(200);
    return { email, id: await userIdOf(admin, email) };
  }
  const passwordStep = (email: string) => http("POST", "/sign-in/email", { body: { email, password: PASSWORD } });
  async function signIn(email: string): Promise<CookieJar> {
    const reply = await passwordStep(email);
    expect(reply.status).toBe(200);
    expect(setsSession(reply)).toBe(true);
    return reply.jar;
  }
  async function startEnrolment(jar: CookieJar): Promise<TOTP> {
    const reply = await http("POST", "/two-factor/enable", { body: { password: PASSWORD }, jar });
    expect(reply.status).toBe(200);
    return totpFromUri(String(bodyField(reply, "totpURI")));
  }
  const verifyTotp = (jar: CookieJar, totp: TOTP) => http("POST", "/two-factor/verify-totp", { body: { code: totp.generate() }, jar });
  async function sessionOf(jar: CookieJar): Promise<unknown> {
    return (await http("GET", "/get-session", { jar })).body;
  }
  function expectChallenge(reply: Reply): void {
    expect(reply.status).toBe(200);
    expect(bodyField(reply, "twoFactorRedirect")).toBe(true);
    expect(setsSession(reply)).toBe(false);
  }

  it(
    "every installed path, by POST and by GET: only the Phase 1 paths answer anything but 404",
    async () => {
      const enabled = new Set<string>(PHASE1_ENABLED_AUTH_PATHS);
      const answered: string[] = [];
      for (const template of ALL_PATHS_1_7_14) {
        const path = template.replace(/:[a-z]+/gi, "x");
        const post = await http("POST", path, { body: {} });
        const get = await http("GET", path);
        if (post.status !== 404 || get.status !== 404) answered.push(template);
      }
      expect(answered.sort()).toEqual([...enabled].sort());
      expect((await http("GET", "/no-such-path")).status).toBe(404);
    },
    120_000,
  );

  it("refuses a cross-origin sign-in (Better Auth's origin check, 403)", async () => {
    const { email } = await signUp();
    const response = await fetch(`${edge.origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example", [EDGE_PEER_HEADER]: "10.250.0.1" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("AUTH-05: the input-limit refusals read the same for an existing and an unknown email", async () => {
    const { email: existing } = await signUp();
    const unknown = newEmail();
    for (const body of [
      { name: "Path Person", password: "p".repeat(PASSWORD_MAX_LENGTH + 1) },
      { name: "n".repeat(NAME_MAX_LENGTH + 1), password: PASSWORD },
    ]) {
      const [a, b] = [
        await http("POST", "/sign-up/email", { body: { ...body, email: existing } }),
        await http("POST", "/sign-up/email", { body: { ...body, email: unknown } }),
      ];
      expect(a.status).toBe(400);
      expect([a.status, a.body]).toEqual([b.status, b.body]);
      expect(["PASSWORD_TOO_LONG", "NAME_TOO_LONG"]).toContain(bodyField(a, "code"));
    }
  });

  describe("AUTH-07: a password change and a 2FA change end every other session", () => {
    it("change password through S1: S2 has no session; S1 continues on its replacement", async () => {
      const { email, id } = await signUp();
      const s1 = await signIn(email);
      const s2 = await signIn(email);
      const changed = await http("POST", "/change-password", {
        body: { currentPassword: PASSWORD, newPassword: `${PASSWORD} changed`, revokeOtherSessions: true },
        jar: s1,
      });
      expect(changed.status).toBe(200);
      expect(await sessionOf(s2)).toBeNull();
      expect(await sessionOf(changed.jar)).not.toBeNull();
      expect(await sessionTokens(admin, id)).toEqual([changed.jar.sessionToken]);
    });

    it("a change without revokeOtherSessions is refused, and both sessions stay", async () => {
      const { email, id } = await signUp();
      const s1 = await signIn(email);
      await signIn(email);
      const refused = await http("POST", "/change-password", {
        body: { currentPassword: PASSWORD, newPassword: `${PASSWORD} changed` },
        jar: s1,
      });
      expect([refused.status, bodyField(refused, "code")]).toEqual([400, "REVOKE_OTHER_SESSIONS_REQUIRED"]);
      expect(await sessionTokens(admin, id)).toHaveLength(2);
    });

    it("2FA enabled through S1, then disabled through S1's replacement: the other session ends each time", async () => {
      const { email, id } = await signUp();
      const s1 = await signIn(email);
      const s2 = await signIn(email);
      const totp = await startEnrolment(s1);
      const enabled = await verifyTotp(s1, totp);
      expect(enabled.status).toBe(200);
      expect(await sessionOf(s2)).toBeNull();
      expect(await sessionTokens(admin, id)).toEqual([enabled.jar.sessionToken]);

      // A second session, through the challenge, then the disable from the first.
      const challenged = await passwordStep(email);
      expectChallenge(challenged);
      const s3 = await verifyTotp(challenged.jar, totp);
      expect(setsSession(s3)).toBe(true);
      const disabled = await http("POST", "/two-factor/disable", { body: { password: PASSWORD }, jar: enabled.jar });
      expect(disabled.status).toBe(200);
      expect(await sessionOf(s3.jar)).toBeNull();
      expect(await sessionTokens(admin, id)).toEqual([disabled.jar.sessionToken]);
    });
  });

  // The two orders of T6 (auth-audit.test.ts), here across the process boundary: the hold is a database trigger.
  describe("AUTH-07 at the sign-in seam", () => {
    it(
      "(a) a password sign-in S3 stored first while S1 enables 2FA: after the enable, S3 has no session",
      async () => {
        const { email, id } = await signUp();
        const s1 = await signIn(email);
        const totp = await startEnrolment(s1);
        const hold = await holdAt(admin, { on: "BEFORE INSERT ON public.session", when: "NEW.issue_reason = 'password'" });
        const signingIn = passwordStep(email);
        await hold.reached();
        const enabling = verifyTotp(s1, totp);
        await waitUntil(async () => (await lockWaiters(admin)) > 0, "the enable to wait for the sign-in");
        await hold.release();
        const [s3, enabled] = await Promise.all([signingIn, enabling]);
        expect(setsSession(s3)).toBe(true);
        expect(enabled.status).toBe(200);
        expect(await sessionOf(s3.jar)).toBeNull();
        expect(await sessionTokens(admin, id)).toEqual([enabled.jar.sessionToken]);
        expectChallenge(await passwordStep(email));
      },
      60_000,
    );

    it(
      "(b) the enable commits while a password sign-in S4 runs: S4 ends with no usable session (the challenge)",
      async () => {
        const { email, id } = await signUp();
        const s1 = await signIn(email);
        const totp = await startEnrolment(s1);
        const hold = await holdAt(admin, { on: "BEFORE UPDATE OF verified ON public.two_factor" });
        const enabling = verifyTotp(s1, totp);
        await hold.reached();
        const signingIn = passwordStep(email);
        await waitUntil(async () => (await lockWaiters(admin)) > 0, "the sign-in to wait for the enable");
        await hold.release();
        const [enabled, s4] = await Promise.all([enabling, signingIn]);
        expect(enabled.status).toBe(200);
        expectChallenge(s4);
        expect(await sessionTokens(admin, id)).toEqual([enabled.jar.sessionToken]);
        expectChallenge(await passwordStep(email));
      },
      60_000,
    );
  });

  it("no enrolment lockout: an enrolment that fails at its last write leaves the user able to complete it", async () => {
    const { email, id } = await signUp();
    const s1 = await signIn(email);
    const totp = await startEnrolment(s1);
    await failOnce(admin, { on: "BEFORE UPDATE OF verified ON public.two_factor" }, "XX000");
    const failed = await verifyTotp(s1, totp);
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(setsSession(failed)).toBe(false);
    expect(await sessionTokens(admin, id)).toEqual([s1.sessionToken]);
    // The user restarts enrolment from the same session and completes it, with no admin step.
    const restarted = await startEnrolment(s1);
    const finished = await verifyTotp(s1, restarted);
    expect(finished.status).toBe(200);
    expectChallenge(await passwordStep(email));
  });
});
