import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { createDb } from "../db/client";
import { runInWorkspace } from "../db/workspace";

// A connection string from the environment, or else from the repository's .env, which `pnpm dev` and the CI image job
// use but Playwright does not load. Only the named value is read from the file.
function envValue(name: "DATABASE_URL" | "DATABASE_MIGRATOR_URL"): string {
  const file = path.resolve(__dirname, "../../../../.env");
  const value = process.env[name] ?? (existsSync(file) ? parseEnv(readFileSync(file, "utf8"))[name] : undefined);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export type OnboardedSettings = {
  country: string | null;
  base_currency: string | null;
  default_currency: string | null;
  timezone: string | null;
  date_format: string | null;
  locale: string | null;
  tax_registered: boolean;
  tax_registration_no: string | null;
  default_tax_name: string | null;
  default_tax_rate_bps: number | null;
};

// The settings row of the user's one workspace, for E2E (Phase 2 plan Task 8). The workspace is found through
// `member` as crm_migrator (a system table, no RLS); the row is read as crm_app under that workspace's setting, since
// workspace_settings forces RLS and has no policy for the migrator.
export async function readWorkspaceSettings(email: string): Promise<OnboardedSettings> {
  const migrator = postgres(envValue("DATABASE_MIGRATOR_URL"), { max: 1, onnotice: () => {} });
  const app = createDb(envValue("DATABASE_URL"), { max: 1 });
  try {
    const memberships = await migrator<{ organization_id: string }[]>`
      select organization_id from member where user_id = (select id from "user" where email = ${email})`;
    const [membership, ...others] = memberships;
    if (!membership || others.length > 0) throw new Error(`expected one membership, found ${memberships.length}`);
    const rows = await runInWorkspace(app.db, membership.organization_id, (tx) =>
      tx.execute<OnboardedSettings>(sql`
        select country, base_currency, default_currency, timezone, date_format, locale, tax_registered,
               tax_registration_no, default_tax_name, default_tax_rate_bps
          from workspace_settings`),
    );
    const [row] = rows;
    if (!row) throw new Error("no workspace_settings row");
    return row;
  } finally {
    await Promise.all([migrator.end(), app.sql.end()]);
  }
}
