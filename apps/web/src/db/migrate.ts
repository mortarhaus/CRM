import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(url: string, migrationsFolder: string): Promise<void> {
  // One connection so the session-level advisory lock and the migration run share a backend.
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(hashtext('crm:migrations'))`;
    try {
      await migrate(drizzle({ client: sql }), { migrationsFolder });
    } finally {
      await sql`select pg_advisory_unlock(hashtext('crm:migrations'))`;
    }
  } finally {
    await sql.end();
  }
}
