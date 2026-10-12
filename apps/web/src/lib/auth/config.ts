import { hashPassword, verifyPassword } from "@crm/core/password";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import type { Database } from "../../db/client";
import * as schema from "../../db/schema";

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
      // Postgres-generated uuids so Phase 1 RLS policies can compare against current_setting(...)::uuid.
      database: { generateId: "uuid" },
    },
    // Info-level lines include user emails (e.g. duplicate sign-up attempts); logs must carry no PII.
    logger: { level: "warn" },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
    },
    plugins: [twoFactor({ issuer: "CRM" }), organization()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
