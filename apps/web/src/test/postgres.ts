import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  // Applies every migration of the folder not applied yet, without resetting the database (after stopBefore).
  applyRemaining(migrationsFolder?: string): Promise<void>;
  stop(): Promise<void>;
}

interface Journal {
  entries: { idx: number; tag: string }[];
}

// A copy of the migrations folder, for upgrade tests only: without the migrations from `stopBefore` (a tag prefix
// such as "0009") on, and with `edit` applied to each migration's SQL.
export async function migrationsCopy(
  options: { stopBefore?: string; edit?: (tag: string, sql: string) => string } = {},
): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "crm-migrations-"));
  await cp(MIGRATIONS_DIR, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
  const cut = options.stopBefore ? journal.entries.findIndex((entry) => entry.tag.startsWith(options.stopBefore ?? "")) : -1;
  if (options.stopBefore && cut < 0) throw new Error(`no migration ${options.stopBefore}`);
  if (cut >= 0) journal.entries = journal.entries.slice(0, cut);
  await writeFile(journalPath, JSON.stringify(journal, null, 2));
  if (options.edit) {
    for (const { tag } of journal.entries) {
      const file = join(folder, `${tag}.sql`);
      await writeFile(file, options.edit(tag, await readFile(file, "utf8")));
    }
  }
  return folder;
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

export function databaseUrl(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

// A fresh Postgres 17 with the five roles bootstrapped and every migration applied as crm_migrator
// (migrate: false leaves the database empty, for the migration runner's own test; stopBefore applies only the
// migrations before that tag prefix, so a test can upgrade a database of an earlier phase with applyRemaining).
export async function startDatabase(options: { migrate?: boolean; stopBefore?: string } = {}): Promise<TestDatabase> {
  const container = await startPostgres();
  const adminUrl = container.getConnectionUri();
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await bootstrapRoles(admin, TEST_ROLE_PASSWORDS);
  } finally {
    await admin.end();
  }
  const migratorUrl = roleUrl(adminUrl, "crm_migrator", TEST_ROLE_PASSWORDS.migrator);
  if (options.migrate ?? true) {
    const folder = options.stopBefore ? await migrationsCopy({ stopBefore: options.stopBefore }) : MIGRATIONS_DIR;
    await runMigrations(migratorUrl, folder);
  }
  return {
    container,
    adminUrl,
    migratorUrl,
    appUrl: roleUrl(adminUrl, "crm_app", TEST_ROLE_PASSWORDS.app),
    workerUrl: roleUrl(adminUrl, "crm_worker", TEST_ROLE_PASSWORDS.worker),
    purgeUrl: roleUrl(adminUrl, "crm_purge", TEST_ROLE_PASSWORDS.purge),
    applyRemaining: (migrationsFolder = MIGRATIONS_DIR) => runMigrations(migratorUrl, migrationsFolder),
    async stop() {
      await container.stop();
    },
  };
}

// The SQLSTATE a query failed with, or undefined if it succeeded. drizzle-orm wraps the driver error;
// postgres.js puts the SQLSTATE on `code`.
export async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    const { code, cause } = error as { code?: string; cause?: { code?: string } };
    return cause?.code ?? code;
  }
}
