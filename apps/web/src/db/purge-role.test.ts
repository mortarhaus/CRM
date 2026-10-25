import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePrivileges, policies, roleAttributes, roleMemberships, tenantTables, workspacePredicateText } from "../test/catalog";
import { sqlState, startDatabase, type TestDatabase } from "../test/postgres";
import { createDb, type DbHandle } from "./client";
import { EXPECTED_PRIVILEGES } from "./privileges";
import { runInWorkspace } from "./workspace";

// Plan Task 13; spec "Audit, logging, privacy" → "crm_purge in Phase 1", part (b1) only. The behavioural tests use
// the real role, connected with its own login (plan Settled item 1): no runtime role can switch to it.
const PHASE_1_ALLOW_LIST = ["database:CONNECT", "schema:public:USAGE", "table:public.audit_log:INSERT"];

let database: TestDatabase;
let admin: postgres.Sql;
// One server connection, so the context checks after a transaction run on the connection it used.
let purge: DbHandle;
let workspaceA: string;
let workspaceB: string;

async function createWorkspace(name: string): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values (${name}, ${`${name}-${randomUUID()}`}, now()) returning id`;
  if (!row) throw new Error("workspace not created");
  return row.id;
}

const insertFor = (workspaceId: string, action: string) =>
  sql`insert into audit_log (workspace_id, action, target_type) values (${workspaceId}, ${action}, 'purge')`;

const insertFromSetting = (action: string) => sql`
  insert into audit_log (workspace_id, action, target_type)
  values ((select nullif(current_setting('app.workspace_id', true), '')::uuid), ${action}, 'purge')`;

async function rowsFor(action: string) {
  return admin<{ workspace_id: string }[]>`select workspace_id from audit_log where action = ${action}`;
}

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  purge = createDb(database.purgeUrl, { max: 1 });
  workspaceA = await createWorkspace("purge-a");
  workspaceB = await createWorkspace("purge-b");
});

afterAll(async () => {
  await purge?.sql.end();
  await admin?.end();
  await database?.stop();
});

describe("crm_purge catalog (part b1)", () => {
  it("is not superuser or BYPASSRLS, logs in with its own login, does not inherit, and is limited to 2 connections", async () => {
    const role = (await roleAttributes(admin)).find((row) => row.name === "crm_purge");
    expect(role).toEqual({ name: "crm_purge", login: true, inherit: false, connectionLimit: 2, elevated: false });
    const [flags] = await admin<{ super: boolean; bypass: boolean }[]>`
      select rolsuper as super, rolbypassrls as bypass from pg_roles where rolname = 'crm_purge'`;
    expect(flags).toEqual({ super: false, bypass: false });
  });

  it("has no member and is a member of nothing, so no runtime role can become it", async () => {
    const memberships = await roleMemberships(admin);
    expect(memberships.filter((row) => row.role === "crm_purge" || row.member === "crm_purge")).toEqual([]);
  });

  it("holds exactly the Phase 1 allow-list: CONNECT, USAGE on public and INSERT on audit_log", async () => {
    expect(await effectivePrivileges(admin, "crm_purge")).toEqual(PHASE_1_ALLOW_LIST);
    expect([...EXPECTED_PRIVILEGES.crm_purge].sort()).toEqual(PHASE_1_ALLOW_LIST);
  });

  it("holds no DELETE, UPDATE or TRUNCATE on audit_log, or on domain_event once it exists", async () => {
    const held: string[] = [];
    for (const table of ["audit_log", "domain_event"]) {
      const [row] = await admin<{ exists: boolean }[]>`select to_regclass(${`public.${table}`}) is not null as exists`;
      if (!row?.exists) continue;
      const [check] = await admin<{ delete: boolean; update: boolean; truncate: boolean; columnUpdate: boolean }[]>`
        select has_table_privilege('crm_purge', ${`public.${table}`}, 'DELETE') as delete,
          has_table_privilege('crm_purge', ${`public.${table}`}, 'UPDATE') as update,
          has_table_privilege('crm_purge', ${`public.${table}`}, 'TRUNCATE') as truncate,
          has_any_column_privilege('crm_purge', ${`public.${table}`}, 'UPDATE') as "columnUpdate"`;
      for (const [privilege, holds] of Object.entries(check ?? {})) if (holds) held.push(`${table} ${privilege}`);
    }
    expect(held).toEqual([]);
  });

  it("has one PERMISSIVE policy in the whole database: FOR INSERT on audit_log with the workspace predicate", async () => {
    const predicate = await workspacePredicateText(admin);
    const rows = await admin<{ schema: string; table: string; name: string; cmd: string; withCheck: string | null }[]>`
      select schemaname as schema, tablename as table, policyname as name, cmd, with_check as "withCheck"
      from pg_policies where permissive = 'PERMISSIVE' and 'crm_purge' = any(roles::text[]) order by 1, 2, 3`;
    expect(rows).toEqual([{ schema: "public", table: "audit_log", name: "audit_log_purge_insert", cmd: "INSERT", withCheck: predicate }]);
  });

  it("is named in the RESTRICTIVE workspace policy of every tenant table", async () => {
    const tables = await tenantTables(admin);
    expect(tables).toContain("audit_log");
    const missing: string[] = [];
    for (const table of tables) {
      const restrictive = (await policies(admin, "public", table)).filter((policy) => policy.permissive === "RESTRICTIVE");
      const named = restrictive.some((policy) => policy.name === `${table}_workspace` && policy.roles.includes("crm_purge"));
      if (!named) missing.push(table);
    }
    expect(missing).toEqual([]);
  });
});

describe("crm_purge behaviour, with its own login (part b1)", () => {
  it("connects as itself", async () => {
    const [row] = await purge.db.execute<{ user: string }>(sql`select current_user as user`);
    expect(row?.user).toBe("crm_purge");
  });

  it("inserts an audit row for workspace A inside runInWorkspace(A)", async () => {
    const action = `purge.${randomUUID()}`;
    await runInWorkspace(purge.db, workspaceA, (tx) => tx.execute(insertFromSetting(action)));
    expect(await rowsFor(action)).toEqual([{ workspace_id: workspaceA }]);
  });

  it("cannot insert a row for workspace B inside workspace A (42501, WITH CHECK)", async () => {
    const action = `purge.${randomUUID()}`;
    expect(await sqlState(runInWorkspace(purge.db, workspaceA, (tx) => tx.execute(insertFor(workspaceB, action))))).toBe("42501");
    expect(await rowsFor(action)).toEqual([]);
  });

  it("cannot read audit_log (42501)", async () => {
    expect(await sqlState(runInWorkspace(purge.db, workspaceA, (tx) => tx.execute(sql`select id from audit_log`)))).toBe("42501");
  });

  it("cannot insert with no workspace set, in a transaction or outside one", async () => {
    const action = `purge.${randomUUID()}`;
    const inTransaction = await sqlState(purge.db.transaction((tx) => tx.execute(insertFromSetting(action))));
    const bare = await sqlState(purge.db.execute(insertFromSetting(action)));
    const named = await sqlState(purge.db.execute(insertFor(workspaceA, action)));
    expect(["23502", "42501"]).toContain(inTransaction);
    expect(["23502", "42501"]).toContain(bare);
    expect(named).toBe("42501");
    expect(await rowsFor(action)).toEqual([]);
  });

  it("keeps no workspace context and no other role on its connection after the transaction", async () => {
    await runInWorkspace(purge.db, workspaceA, (tx) => tx.execute(insertFromSetting(`purge.${randomUUID()}`)));
    const [row] = await purge.db.execute<{ setting: string | null; user: string; session: string }>(
      sql`select current_setting('app.workspace_id', true) as setting, current_user as user, session_user as session`,
    );
    expect(row).toEqual({ setting: "", user: "crm_purge", session: "crm_purge" });
  });

  it("is refused a third concurrent connection (CONNECTION LIMIT 2, 53300)", async () => {
    await purge.db.execute(sql`select 1`);
    const second = postgres(database.purgeUrl, { max: 1, onnotice: () => {} });
    const third = postgres(database.purgeUrl, { max: 1, onnotice: () => {} });
    try {
      await second`select 1`;
      expect(await sqlState(third`select 1`)).toBe("53300");
    } finally {
      await third.end({ timeout: 1 });
      await second.end({ timeout: 1 });
    }
  });
});
