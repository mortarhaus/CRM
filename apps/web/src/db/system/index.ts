// The system module (spec Tenancy, "System module"; TEN-10): the only way app code reaches a table without
// RLS. App code imports from here, never from the modules behind it.
export {
  AUTH_DETAIL_CAUSES,
  AUTH_DETAIL_KEYS,
  AUTH_DETAIL_METHODS,
  AUTH_DETAIL_REASONS,
  AUTH_EVENTS,
  type AuthEvent,
  type AuthUserKey,
  lockAuthUsers,
  SIGN_IN_EMAIL_LOCK_SPACE,
  SESSION_ISSUE_LABELS,
  type SessionIssueLabel,
} from "./auth-audit";
export { type AuthTransactions, createAuthTransactions } from "./auth-transaction";
export { ensureBillingAccount } from "./billing";
export { PGBOSS_SCHEMA_VERSION, pingDatabase, pingQueue } from "./health";
export { revokeOwnSession } from "./sessions";
export { getUserEmail } from "./users";
export { cleanupExpired, cleanupExpiredCounters, type ConsumeResult, consume, giveBack } from "./rate-limit";
// The worker opens and closes its crm_app pool through these (no query: see src/db/index.ts).
export { type AppDatabase, DatabaseAlreadyOpenError, openDatabase } from "../index";
export {
  ensureWorkspaceSettings,
  findMembership,
  getMembership,
  healWorkspaceSettings,
  listWorkspaceIds,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "./workspaces";
