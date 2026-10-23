import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { bootstrapRoles } from "../db/bootstrap";
import { runMigrations } from "../db/migrate";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

// Fixed values for throwaway test containers only.
export const TEST_ROLE_PASSWORDS = {
  migrator: "crm-migrator-test-only",
  app: "crm-app-test-only",
  worker: "crm-worker-test-only",
  purge: "crm-purge-test-only",
} as const;

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  // The container superuser: only for schema tests that must read past grants.
  adminUrl: string;
  migratorUrl: string;
  appUrl: string;
  workerUrl: string;
  purgeUrl: string;
  stop(): Promise<void>;
}

export function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer("postgres:17-alpine").start();
}

export function roleUrl(adminUrl: string, role: string, password: string): string {
  const url = new URL(adminUrl);
  url.username = role;
  url.password = password;
  return url.toString();
}

// A fresh Postgres 17 with the five roles bootstrapped and every migration applied as crm_migrator
// (migrate: false leaves the database empty, for the migration runner's own test).
export async function startDatabase(options: { migrate?: boolean } = {}): Promise<TestDatabase> {
  const container = await startPostgres();
  const adminUrl = container.getConnectionUri();
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
  } finally {
    await admin.end();
  }
  const migratorUrl = roleUrl(adminUrl, "crm_migrator", TEST_ROLE_PASSWORDS.migrator);
  if (options.migrate ?? true) await runMigrations(migratorUrl, MIGRATIONS_DIR);
  return {
    container,
    adminUrl,
    migratorUrl,
    appUrl: roleUrl(adminUrl, "crm_app", TEST_ROLE_PASSWORDS.app),
    workerUrl: roleUrl(adminUrl, "crm_worker", TEST_ROLE_PASSWORDS.worker),
    purgeUrl: roleUrl(adminUrl, "crm_purge", TEST_ROLE_PASSWORDS.purge),
    async stop() {
      await container.stop();
    },
  };
}
