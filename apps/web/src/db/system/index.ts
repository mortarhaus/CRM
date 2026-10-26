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
export { pingDatabase } from "./health";
export {
  ensureWorkspaceSettings,
  findMembership,
  getMembership,
  healWorkspaceSettings,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "./workspaces";
