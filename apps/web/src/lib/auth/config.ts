import { hashPassword, verifyPassword } from "@crm/core/password";
import { INVITATION_EXPIRY_SECONDS, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@crm/core/security";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import type { Database } from "../../db/client";
import * as schema from "../../db/schema";
import { ensureBillingAccount, ensureWorkspaceSettings } from "../../db/system";
import { isHttpsUrl, isLoopbackUrl } from "../origin";
import { enforceInputLimits } from "./input-limits";

export interface AuthDeps {
  db: Database;
  secret: string;
  baseURL: string;
}

export function createAuth({ db, secret, baseURL }: AuthDeps) {
  return betterAuth({
    appName: "CRM",
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    advanced: {
      // Better Auth only sets Secure when baseURL is https; force it for every non-loopback origin.
      useSecureCookies: isHttpsUrl(baseURL) || !isLoopbackUrl(baseURL),
      // Postgres-generated uuids so Phase 1 RLS policies can compare against current_setting(...)::uuid.
      database: { generateId: "uuid" },
    },
    // Info-level lines include user emails (e.g. duplicate sign-up attempts); logs must carry no PII.
    logger: { level: "warn" },
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
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
