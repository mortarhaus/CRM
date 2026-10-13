import path from "node:path";
import { runMigrations } from "./src/db/migrate";
import { getEnv } from "./src/lib/env";

async function main(): Promise<void> {
  const env = getEnv();
  await runMigrations(env.DATABASE_MIGRATOR_URL, path.resolve(process.cwd(), "drizzle"));
  console.log(JSON.stringify({ level: "info", msg: "migrations applied" }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
