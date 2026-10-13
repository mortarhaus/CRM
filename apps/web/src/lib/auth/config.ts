import { hashPassword, verifyPassword } from "@crm/core/password";
import { INVITATION_EXPIRY_SECONDS } from "@crm/core/security";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import type { Database } from "../../db/client";
import * as schema from "../../db/schema";
import { isHttpsUrl, isLoopbackUrl } from "../origin";

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
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
    },
    plugins: [twoFactor({ issuer: "CRM" }), organization({ invitationExpiresIn: INVITATION_EXPIRY_SECONDS })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
