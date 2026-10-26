import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { AuthUserKey, SessionIssueLabel } from "../../db/system";

// The requests whose user is locked for the whole request transaction (lockAuthUsers): every path that reads the
// 2FA state to decide what to write, or writes it. With the lock, Better Auth's own read of the 2FA flag and of the
// recovery codes is the value its writes commit against (plan Task 31 R5 to R7).
export const SERIALISED_PATHS = new Set([
  "/sign-in/email",
  "/change-password",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/generate-backup-codes",
]);

// Better Auth 1.7.6's two-factor challenge cookie (plugins/two-factor/constant.mjs).
const TWO_FACTOR_COOKIE = "two_factor";

// The session fields /list-sessions may return (plan Task 31 R10): never the token.
const LISTED_SESSION_FIELDS = ["id", "userId", "createdAt", "updatedAt", "expiresAt", "ipAddress", "userAgent"] as const;

// session.issue_reason for a session Better Auth is about to insert. The audit trigger writes the rows the label
// names and refuses a session labelled null. Always returned, never left out: a rotation copies the old row's
// fields into the new one (internal-adapter createSession, `...rest`), and must not keep the old label.
export async function labelSessionIssue(
  session: { userId: string },
  ctx: GenericEndpointContext | null,
): Promise<SessionIssueLabel | null> {
  switch (ctx?.path) {
    case "/sign-in/email": {
      // The same flag the two-factor plugin's challenge reads: the user row is locked for the request.
      const user = await ctx.context.internalAdapter.findUserById(session.userId);
      if (!user) return null;
      return (user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled ? "password_two_factor" : "password";
    }
    case "/two-factor/verify-totp":
      // verifyTwoFactor takes the sign-in branch exactly when getSessionFromCtx cached null (fact viii).
      return ctx.context.session ? "rotation_two_factor_enabled" : "two_factor_totp";
    case "/two-factor/verify-backup-code":
      return ctx.context.session ? null : "two_factor_backup_code";
    case "/two-factor/disable":
      return "rotation_two_factor_disabled";
    case "/two-factor/generate-backup-codes":
      return "rotation_backup_codes_regenerated";
    case "/change-password":
      return "rotation_password_changed";
    default:
      return null;
  }
}

// The users a serialised request acts for: the email it signs in with (lower-cased, as Better Auth looks it up;
// lockAuthUsers locks the email itself too, account or not), the user of its session cookie and the user of its
// two-factor challenge cookie. Both cookies are read, because a request may carry both.
async function actingUsers(ctx: GenericEndpointContext): Promise<AuthUserKey[]> {
  if (ctx.path === "/sign-in/email") {
    const email = (ctx.body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" ? [{ email: email.toLowerCase() }] : [];
  }
  const keys: AuthUserKey[] = [];
  const token = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret);
  if (token) {
    const found = await ctx.context.internalAdapter.findSession(token);
    if (found) keys.push({ id: found.session.userId });
  }
  const challenge = await ctx.getSignedCookie(ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name, ctx.context.secret);
  if (challenge) {
    const found = await ctx.context.internalAdapter.findVerificationValue(challenge);
    if (found) keys.push({ id: found.value });
  }
  return keys;
}

// What the endpoint returned, as an after-hook sees it (api/dispatch.mjs: an APIError when it failed).
function returnedBy(ctx: GenericEndpointContext): unknown {
  return (ctx.context as { returned?: unknown }).returned;
}

// Regenerating the recovery codes is a 2FA change (plan Task 31 R5): it ends every session of the user, the
// changer's included, and the changer continues on a replacement session set by the same response. It runs in the
// request transaction, so the new codes, the revocation, the replacement and their audit rows commit together.
async function rotateAfterRegeneration(ctx: GenericEndpointContext): Promise<void> {
  const current = ctx.context.session;
  if (!current || isAPIError(returnedBy(ctx))) return;
  await ctx.context.internalAdapter.deleteUserSessions(current.user.id);
  const replacement = await ctx.context.internalAdapter.createSession(current.user.id, false, current.session);
  await setSessionCookie(ctx, { session: replacement, user: current.user });
}

function listedSessionsOnly(ctx: GenericEndpointContext) {
  const returned = returnedBy(ctx);
  if (!Array.isArray(returned)) return;
  return ctx.json(
    returned.map((entry: Record<string, unknown>) =>
      Object.fromEntries(LISTED_SESSION_FIELDS.filter((field) => field in entry).map((field) => [field, entry[field]])),
    ),
  );
}

export interface SessionAuditDeps {
  lockUsers(keys: readonly AuthUserKey[]): Promise<void>;
}

// Listed after twoFactor in `plugins`: its before-hook runs after enforceInputLimits, its after-hooks after the
// two-factor plugin's.
export function crmSessionAudit({ lockUsers }: SessionAuditDeps) {
  return {
    id: "crm-session-audit",
    hooks: {
      before: [
        {
          matcher: (ctx) => SERIALISED_PATHS.has(ctx.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            await lockUsers(await actingUsers(ctx));
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === "/two-factor/generate-backup-codes",
          handler: createAuthMiddleware(rotateAfterRegeneration),
        },
        {
          matcher: (ctx) => ctx.path === "/list-sessions",
          handler: createAuthMiddleware(async (ctx) => listedSessionsOnly(ctx)),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
