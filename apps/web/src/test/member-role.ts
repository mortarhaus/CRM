import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import postgres from "postgres";

// The migrator's connection: from the environment, or else from the repository's .env, which `pnpm dev` and the CI
// image and E2E jobs use but Playwright does not load. Only this one value is read from the file.
function migratorUrl(): string {
  const file = path.resolve(__dirname, "../../../../.env");
  const url =
    process.env.DATABASE_MIGRATOR_URL ??
    (existsSync(file) ? parseEnv(readFileSync(file, "utf8")).DATABASE_MIGRATOR_URL : undefined);
  if (!url) throw new Error("DATABASE_MIGRATOR_URL is not set");
  return url;
}

// Changes the role of the user's one membership, for E2E (plan Task 27). crm_migrator owns `member`, a system table
// with no RLS, so a test can make an Owner into Staff without a second account to demote them.
export async function setMemberRole(email: string, role: "owner" | "admin" | "staff"): Promise<void> {
  const sql = postgres(migratorUrl(), { max: 1, onnotice: () => {} });
  try {
    const updated = await sql`
      update member set "role" = ${role} where user_id = (select id from "user" where email = ${email}) returning id`;
    if (updated.length !== 1) throw new Error(`expected one membership, updated ${updated.length}`);
  } finally {
    await sql.end();
  }
}
