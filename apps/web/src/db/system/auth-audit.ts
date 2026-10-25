import { inArray, or } from "drizzle-orm";
import type { Database } from "../client";
import { user } from "../schema";

// The closed vocabulary of auth_audit_log (spec Data model, `auth_audit_log`; plan Task 31, open point D). The
// triggers of migration 0009 are its only writers and use exactly these values.
export const AUTH_EVENTS = [
  "session_issued",
  "two_factor_verified",
  "two_factor_enabled",
  "two_factor_disabled",
  "two_factor_backup_codes_changed",
] as const;
export type AuthEvent = (typeof AUTH_EVENTS)[number];

// The `detail` keys and their labels (plan Task 31 R13). `session_id` holds the internal id of the session a row records.
export const AUTH_DETAIL_KEYS = ["reason", "method", "cause", "session_id"] as const;
export const AUTH_DETAIL_REASONS = ["sign_in", "two_factor_pending", "rotation"] as const;
export const AUTH_DETAIL_METHODS = ["password", "totp", "backup_code"] as const;
export const AUTH_DETAIL_CAUSES = ["two_factor_enabled", "two_factor_disabled", "backup_codes_regenerated", "password_changed"] as const;

// What Better Auth's session hook writes into session.issue_reason. Migration 0009 maps each label to its rows and
// refuses a session row with any other value, so no session exists without its audit row.
export const SESSION_ISSUE_LABELS = [
  "password",
  "password_two_factor",
  "two_factor_totp",
  "two_factor_backup_code",
  "rotation_two_factor_enabled",
  "rotation_two_factor_disabled",
  "rotation_backup_codes_regenerated",
  "rotation_password_changed",
] as const;
export type SessionIssueLabel = (typeof SESSION_ISSUE_LABELS)[number];

export type AuthUserKey = { id: string } | { email: string };

// user.id is a uuid; a key read from a verification value that is not one names no user.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Takes the row lock of each user the request acts for, until the request transaction ends (plan Task 31). Every
// sign-in and 2FA request of a user runs one at a time, so no 2FA change commits between a request's read of the
// 2FA state and its writes. Rows are locked in id order, so two requests never wait for each other in a cycle.
export async function lockAuthUsers(db: Database, keys: readonly AuthUserKey[]): Promise<void> {
  const ids = keys.flatMap((key) => ("id" in key && UUID.test(key.id) ? [key.id] : []));
  const emails = keys.flatMap((key) => ("email" in key ? [key.email] : []));
  if (ids.length === 0 && emails.length === 0) return;
  const matches = or(
    ids.length > 0 ? inArray(user.id, ids) : undefined,
    emails.length > 0 ? inArray(user.email, emails) : undefined,
  );
  await db.select({ id: user.id }).from(user).where(matches).orderBy(user.id).for("no key update");
}
