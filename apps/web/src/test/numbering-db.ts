import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { startDatabase, type TestDatabase } from "./postgres";

// A test database with onboarded workspaces and their invoice counter, for the allocator tests (Phase 2 plan
// Task 18). Rows are written as the container superuser; the code under test runs as crm_app.
export interface NumberingTestDb {
  database: TestDatabase;
  admin: postgres.Sql;
  // A workspace with a short code and time zone, and an invoice counter with this pattern and rule at 0.
  newWorkspace(options?: { pattern?: string; resetRule?: string; shortCode?: string | null; timeZone?: string }): Promise<string>;
  counterOf(workspaceId: string): Promise<{ counter: number; last_reset_period: string | null }>;
  stop(): Promise<void>;
}

export async function startNumberingDb(): Promise<NumberingTestDb> {
  const database = await startDatabase();
  const admin = postgres(database.adminUrl, { max: 2, onnotice: () => {} });
  return {
    database,
    admin,
    async newWorkspace({ pattern = "INV-{CODE}-{YYYY}-{SEQ:4}", resetRule = "yearly", shortCode = "ACME", timeZone = "Asia/Kuala_Lumpur" } = {}) {
      const [org] = await admin<{ id: string }[]>`
        insert into organization (name, slug, created_at) values ('numbering', ${`numbering-${randomUUID()}`}, now()) returning id`;
      if (!org) throw new Error("workspace not created");
      await admin`insert into workspace_settings (workspace_id, country, timezone, short_code)
        values (${org.id}, 'MY', ${timeZone}, ${shortCode})`;
      await admin`insert into doc_sequence (workspace_id, doc_type, pattern, reset_rule)
        values (${org.id}, 'invoice', ${pattern}, ${resetRule})`;
      return org.id;
    },
    async counterOf(workspaceId) {
      const [row] = await admin<{ counter: number; last_reset_period: string | null }[]>`
        select counter, last_reset_period from doc_sequence where workspace_id = ${workspaceId} and doc_type = 'invoice'`;
      if (!row) throw new Error("no doc_sequence row");
      return row;
    },
    async stop() {
      await admin.end();
      await database.stop();
    },
  };
}
