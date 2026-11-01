import { hashPassword, verifyPassword } from "@crm/core/password";
import { INVITATION_EXPIRY_SECONDS, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@crm/core/security";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import type { Database } from "../../db/client";
import * as schema from "../../db/schema";
import { createAuthTransactions, ensureBillingAccount, ensureWorkspaceSettings, lockAuthUsers } from "../../db/system";
import { isHttpsUrl, isLoopbackUrl } from "../origin";
import { CLIENT_IP_HEADER } from "./client-ip";
import { enforceInputLimits } from "./input-limits";
import { logAuth } from "./log";
import { rateLimitOptions } from "./rate-limit-rules";
import { withRequestTransactions } from "./request-transaction";
import { crmSessionAudit, labelSessionIssue } from "./session-audit";

// Invitations are a Phase 3 feature (plan Task 10; Task 24 replaces this with the full Phase 1 allow-list).
// disabledPaths applies to HTTP requests: Better Auth answers 404 before any handler runs.
export const INVITATION_PATHS = [
  "/organization/invite-member",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
  "/organization/cancel-invitation",
  "/organization/get-invitation",
  "/organization/list-invitations",
  "/organization/list-user-invitations",
] as const;

export interface AuthDeps {
  db: Database;
  secret: string;
  baseURL: string;
  // The rate limiter's own pool (getLimiterDb): its consumes autocommit outside the request transaction.
  limiterDb: Database;
}

// The Better Auth options. `adapterDb` is the database Better Auth's adapter uses: createAuth passes the one that
// routes each request to its transaction. Tests build an instance without that wrapper only as a control.
export function authOptions({
  db,
  secret,
  baseURL,
  adapterDb = db,
  limiterDb = db,
}: Omit<AuthDeps, "limiterDb"> & { adapterDb?: Database; limiterDb?: Database }) {
  return {
    appName: "CRM",
    secret,
    baseURL,
    database: drizzleAdapter(adapterDb, { provider: "pg", schema }),
    advanced: {
      // Better Auth only sets Secure when baseURL is https; force it for every non-loopback origin.
      useSecureCookies: isHttpsUrl(baseURL) || !isLoopbackUrl(baseURL),
      // Postgres-generated uuids so Phase 1 RLS policies can compare against current_setting(...)::uuid.
      database: { generateId: "uuid" },
      // Only the address prepareAuthRequest derived (plan Task 22): it strips any caller copy first.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    // Info-level lines include user emails (e.g. duplicate sign-up attempts); logs must carry no PII. logAuth
    // also drops a failed query's SQL and parameters.
    logger: { level: "warn", log: logAuth },
    // A thrown error reaches withRequestTransactions, which rolls back and logs it safely; better-call's own
    // fallback would log the whole error, parameters included.
    onAPIError: { throw: true },
    session: {
      additionalFields: {
        // Why the session was issued (plan Task 31): set only by the hook below, read only by the audit trigger.
        issueReason: { type: "string", required: false, input: false, returned: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => ({ data: { issueReason: await labelSessionIssue(session, ctx) } }),
        },
      },
    },
    disabledPaths: [...INVITATION_PATHS],
    // Database-backed limits (spec "Rate limits"; plan Task 23), consumed on the limiter's own pool.
    rateLimit: rateLimitOptions(limiterDb),
    emailAndPassword: {
      enabled: true,
      // Spec: uniform responses on sign-up. With auto sign-in off, a duplicate email gets the same
      // synthetic success as a new one, and the user signs in explicitly afterwards.
      autoSignIn: false,
      // enforceInputLimits is the real check, in characters. Better Auth counts UTF-16 units, so its
      // maximum allows two units per character to keep it from refusing 128 emoji.
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH * 2,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
    },
    hooks: { before: enforceInputLimits },
    plugins: [
      twoFactor({ issuer: "CRM" }),
      organization({
        invitationExpiresIn: INVITATION_EXPIRY_SECONDS,
        // Set only by the server (input: false): the creator's billing account, from the before-create hook.
        schema: {
          organization: {
            additionalFields: { billingAccountId: { type: "string", required: false, input: false } },
          },
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization: workspace, user }) => ({
            data: { ...workspace, billingAccountId: await ensureBillingAccount(db, user.id, user.name) },
          }),
          afterCreateOrganization: ({ organization: workspace }) => ensureWorkspaceSettings(db, workspace.id),
        },
      }),
      crmSessionAudit({ lockUsers: (keys) => lockAuthUsers(adapterDb, keys) }),
    ],
  } satisfies BetterAuthOptions;
}

export class SharedLimiterPoolError extends Error {
  override readonly name = "SharedLimiterPoolError";

  constructor() {
    super("the rate limiter needs a pool of its own, not the request transactions' pool");
  }
}

export function createAuth(deps: AuthDeps) {
  // On the request pool a consume inside a request transaction would fail (PoolBypassError) or, routed into the
  // transaction, hold the counter row until commit.
  if (deps.limiterDb.$client === deps.db.$client) throw new SharedLimiterPoolError();
  const transactions = createAuthTransactions(deps.db);
  return withRequestTransactions(betterAuth(authOptions({ ...deps, adapterDb: transactions.db })), transactions);
}

export type Auth = ReturnType<typeof createAuth>;
