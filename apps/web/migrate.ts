import path from "node:path";
import { runMigrations } from "./src/db/migrate";
import { type ContainerRole, migrateEnvFor } from "./src/lib/env";

async function main(): Promise<void> {
  // docker/entrypoint.sh passes the container's role: its own schema is checked, never another container's (the
  // worker has no TRUSTED_CLIENT_IP_HEADER). No role (`migrate`, `pnpm db:migrate`): the migrator URL only.
  const arg = process.argv[2];
  const role: ContainerRole | undefined = arg === "web" || arg === "worker" ? arg : undefined;
  const env = migrateEnvFor(role, process.env);
  await runMigrations(env.DATABASE_MIGRATOR_URL, path.resolve(process.cwd(), "drizzle"));
  console.log(JSON.stringify({ level: "info", msg: "migrations applied" }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
