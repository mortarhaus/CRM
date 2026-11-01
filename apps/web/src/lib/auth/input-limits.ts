import { normalizePassword } from "@crm/core/password";
import {
  characterCount,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@crm/core/security";
import { APIError, createAuthMiddleware } from "better-auth/api";

export type LimitErrorCode = "PASSWORD_TOO_SHORT" | "PASSWORD_TOO_LONG" | "NAME_TOO_LONG" | "WORKSPACE_NAME_TOO_LONG";

// Every Better Auth 1.7.14 endpoint with a path that stores a new password, a user name or a workspace
// name, and where its body holds that value. The server-only `setPassword` has no path and is unused.
const NEW_PASSWORD_FIELD: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};
const USER_NAME_PATHS = new Set(["/sign-up/email", "/update-user"]);
// Trusted devices are not a Phase 1 feature (spec "Better Auth endpoints"; plan Task 31 R9): the two-factor
// plugin has no option to turn them off, so a request for one is refused before it can mint a record or cookie.
const TRUST_DEVICE_PATHS = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/two-factor/verify-otp"]);
// Every body field that carries a password, new or to verify, on any endpoint.
const PASSWORD_FIELDS = ["password", "newPassword", "currentPassword"];

type Body = Record<string, unknown>;

function asBody(value: unknown): Body | undefined {
  return typeof value === "object" && value !== null ? (value as Body) : undefined;
}

// No form sends trustDevice or changes a password yet, so these refusals have no user-facing message.
type RefusalCode = LimitErrorCode | "TRUST_DEVICE_DISABLED" | "REVOKE_OTHER_SESSIONS_REQUIRED";

function refuse(code: RefusalCode): never {
  throw new APIError("BAD_REQUEST", { code, message: code });
}

function checkPassword(value: unknown): void {
  if (typeof value !== "string") return;
  const length = characterCount(normalizePassword(value));
  if (length < PASSWORD_MIN_LENGTH) refuse("PASSWORD_TOO_SHORT");
  if (length > PASSWORD_MAX_LENGTH) refuse("PASSWORD_TOO_LONG");
}

function checkMax(value: unknown, max: number, code: LimitErrorCode): void {
  if (typeof value === "string" && characterCount(value) > max) refuse(code);
}

// Runs before every endpoint, for `auth.api` calls and HTTP requests alike, and before Better Auth
// looks the email up, so a refusal reads the same for a new and an existing account (AUTH-05).
// Better Auth's own length checks count UTF-16 units; this one counts characters (code points) of the
// NFC form, the form that is hashed. Passing the NFC form on keeps Better Auth's checks on that form too.
export const enforceInputLimits = createAuthMiddleware(async (ctx) => {
  const body = asBody(ctx.body);
  if (!body) return;
  if (TRUST_DEVICE_PATHS.has(ctx.path) && body.trustDevice) refuse("TRUST_DEVICE_DISABLED");
  // AUTH-07 (Charlie 2026-11-01, decision 2 A): a password change ends every other session. Better Auth 1.7.14 does
  // that only when the body asks (api/routes/update-user.mjs:174, deleteUserSessions under `if (revokeOtherSessions)`),
  // so a change that does not ask is refused before the endpoint runs.
  if (ctx.path === "/change-password" && body.revokeOtherSessions !== true) refuse("REVOKE_OTHER_SESSIONS_REQUIRED");
  const passwordField = NEW_PASSWORD_FIELD[ctx.path];
  if (passwordField) checkPassword(body[passwordField]);
  if (USER_NAME_PATHS.has(ctx.path)) checkMax(body.name, NAME_MAX_LENGTH, "NAME_TOO_LONG");
  if (ctx.path === "/organization/create") checkMax(body.name, WORKSPACE_NAME_MAX_LENGTH, "WORKSPACE_NAME_TOO_LONG");
  if (ctx.path === "/organization/update") {
    checkMax(asBody(body.data)?.name, WORKSPACE_NAME_MAX_LENGTH, "WORKSPACE_NAME_TOO_LONG");
  }
  const normalized: Body = {};
  for (const field of PASSWORD_FIELDS) {
    const value = body[field];
    if (typeof value === "string") normalized[field] = normalizePassword(value);
  }
  if (Object.keys(normalized).length > 0) return { context: { body: { ...body, ...normalized } } };
});
