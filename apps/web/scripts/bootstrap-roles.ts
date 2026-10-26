import { bootstrapRolesAt } from "../src/db/bootstrap";
import { parseBootstrapEnv } from "../src/lib/env";

async function main(): Promise<void> {
  const env = parseBootstrapEnv(process.env);
  await bootstrapRolesAt(env.DATABASE_ADMIN_URL, {
    migrator: env.CRM_MIGRATOR_PASSWORD,
    app: env.CRM_APP_PASSWORD,
    worker: env.CRM_WORKER_PASSWORD,
    purge: env.CRM_PURGE_PASSWORD,
  });
  console.log(JSON.stringify({ level: "info", msg: "roles bootstrapped" }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
