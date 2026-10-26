import type postgres from "postgres";

export const APP_ROLES = ["crm_migrator", "crm_app", "crm_worker", "crm_purge", "crm_link_resolver"] as const;

export interface RoleAttributes {
  name: string;
  login: boolean;
  inherit: boolean;
  connectionLimit: number;
  elevated: boolean;
}

export function roleAttributes(sql: postgres.Sql): Promise<RoleAttributes[]> {
  return sql<RoleAttributes[]>`
    select rolname as name, rolcanlogin as login, rolinherit as inherit, rolconnlimit as "connectionLimit",
      (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication) as elevated
    from pg_roles where rolname = any(${[...APP_ROLES]}) order by rolname`.then((rows) => [...rows]);
}

export interface RoleMembership {
  role: string;
  member: string;
  admin: boolean;
  inherit: boolean;
  set: boolean;
}

// Every membership that touches one of the five roles, on either side.
export function roleMemberships(sql: postgres.Sql): Promise<RoleMembership[]> {
  return sql<RoleMembership[]>`
    select pg_get_userbyid(roleid) as role, pg_get_userbyid(member) as member, admin_option as admin,
      inherit_option as inherit, set_option as set
    from pg_auth_members
    where pg_get_userbyid(roleid) = any(${[...APP_ROLES]})
       or pg_get_userbyid(member) = any(${[...APP_ROLES]})
    order by 1, 2`.then((rows) => [...rows]);
}

export const SCANNED_SCHEMAS = ["public", "pgboss", "drizzle"] as const;

// Effective privileges of a role (or PUBLIC) as sorted strings. The has_*_privilege functions count
// what comes through PUBLIC and through role membership, so nothing granted indirectly is missed.
// Missing schemas are skipped (pgboss exists only after its migration).
export async function effectivePrivileges(
  sql: postgres.Sql,
  role: string,
  schemas: readonly string[] = SCANNED_SCHEMAS,
): Promise<string[]> {
  const grantee = role === "PUBLIC" ? "public" : role;
  const names = [...schemas];
  const rows = await sql<{ privilege: string }[]>`
    with
      schemas as (select oid, nspname from pg_namespace where nspname = any(${names})),
      relations as (
        select c.oid, s.nspname, c.relname, c.relkind
        from pg_class c join schemas s on s.oid = c.relnamespace
        where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      )
    select 'database:' || p as privilege
      from unnest(array['CONNECT', 'CREATE', 'TEMPORARY']) p
      where has_database_privilege(${grantee}, current_database(), p)
    union all
    select 'schema:' || s.nspname || ':' || p
      from schemas s, unnest(array['USAGE', 'CREATE']) p
      where has_schema_privilege(${grantee}, s.oid, p)
    union all
    select 'table:' || r.nspname || '.' || r.relname || ':' || p
      from relations r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) p
      where r.relkind <> 'S' and has_table_privilege(${grantee}, r.oid, p)
    union all
    select 'column:' || r.nspname || '.' || r.relname || '.' || a.attname || ':' || p
      from relations r
      join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped,
      unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) p
      where r.relkind <> 'S'
        and not has_table_privilege(${grantee}, r.oid, p)
        and has_column_privilege(${grantee}, r.oid, a.attnum, p)
    union all
    select 'sequence:' || r.nspname || '.' || r.relname || ':' || p
      from relations r, unnest(array['USAGE', 'SELECT', 'UPDATE']) p
      where r.relkind = 'S' and has_sequence_privilege(${grantee}, r.oid, p)
    union all
    select 'function:' || s.nspname || '.' || f.proname || '(' || pg_get_function_identity_arguments(f.oid) || '):EXECUTE'
      from pg_proc f join schemas s on s.oid = f.pronamespace
      where has_function_privilege(${grantee}, f.oid, 'EXECUTE')`;
  return rows.map((row) => row.privilege).sort();
}

// Every table, view, sequence and function in the scanned schemas whose owner is not the given role.
export async function objectsNotOwnedBy(sql: postgres.Sql, owner: string): Promise<string[]> {
  const names = [...SCANNED_SCHEMAS];
  const rows = await sql<{ object: string }[]>`
    select n.nspname || '.' || c.relname || ' (' || c.relkind::text || ', ' || pg_get_userbyid(c.relowner) || ')' as object
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any(${names}) and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
        and pg_get_userbyid(c.relowner) <> ${owner}
    union all
    select n.nspname || '.' || f.proname || ' (function, ' || pg_get_userbyid(f.proowner) || ')'
      from pg_proc f join pg_namespace n on n.oid = f.pronamespace
      where n.nspname = any(${names}) and pg_get_userbyid(f.proowner) <> ${owner}
    union all
    select nspname || ' (schema, ' || pg_get_userbyid(nspowner) || ')'
      from pg_namespace
      where nspname = any(${names}) and nspname <> 'public' and pg_get_userbyid(nspowner) <> ${owner}`;
  return rows.map((row) => row.object).sort();
}

// Tables without RLS, reached only through the system module (spec Tenancy, revision 8): the Better Auth
// tables, billing_account, the rate-limit counters and auth_audit_log. rls.test.ts checks that the tables
// without RLS in public are exactly these.
export const NO_RLS_ALLOW_LIST = [
  "account",
  "auth_audit_log",
  "billing_account",
  "invitation",
  "member",
  "organization",
  "rate_limit",
  "session",
  "two_factor",
  "user",
  "verification",
] as const;

// Every table in the schema that is not on the no-RLS allow-list.
export async function tenantTables(sql: postgres.Sql, schema = "public"): Promise<string[]> {
  const allowList = [...NO_RLS_ALLOW_LIST];
  const rows = await sql<{ name: string }[]>`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('r', 'p') and not (c.relname = any(${allowList}))
    order by 1`;
  return rows.map((row) => row.name);
}

export interface RowSecurity {
  enabled: boolean;
  forced: boolean;
}

export async function rowSecurity(sql: postgres.Sql, schema: string, table: string): Promise<RowSecurity | undefined> {
  const [row] = await sql<RowSecurity[]>`
    select c.relrowsecurity as enabled, c.relforcerowsecurity as forced
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relname = ${table}`;
  return row;
}

export interface Policy {
  table: string;
  name: string;
  permissive: "PERMISSIVE" | "RESTRICTIVE";
  roles: string[];
  cmd: "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  qual: string | null;
  withCheck: string | null;
}

// Every policy in the schema, or on one table of it, with its roles sorted.
export async function policies(sql: postgres.Sql, schema: string, table?: string): Promise<Policy[]> {
  const rows = await sql<Policy[]>`
    select tablename as table, policyname as name, permissive, roles::text[] as roles, cmd, qual,
      with_check as "withCheck"
    from pg_policies
    where schemaname = ${schema} and (${table ?? null}::name is null or tablename = ${table ?? null}::name)
    order by tablename, policyname`;
  return rows.map((row) => ({ ...row, roles: [...row.roles].sort() }));
}

// The workspace predicate of every tenant policy (spec Tenancy; plan Global Constraints).
export const WORKSPACE_PREDICATE =
  "workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid)";

// The text PostgreSQL stores for WORKSPACE_PREDICATE, read back from a throwaway policy, so a comparison
// never depends on a hand-typed pg_get_expr string.
export function workspacePredicateText(sql: postgres.Sql): Promise<string> {
  return sql.begin(async (tx) => {
    await tx.unsafe("CREATE SCHEMA IF NOT EXISTS scratch");
    await tx.unsafe("CREATE TABLE scratch.rls_reference (workspace_id uuid)");
    await tx.unsafe(`CREATE POLICY rls_reference ON scratch.rls_reference USING (${WORKSPACE_PREDICATE})`);
    const [row] = await tx<{ qual: string }[]>`
      select qual from pg_policies where schemaname = 'scratch' and tablename = 'rls_reference'`;
    await tx.unsafe("DROP TABLE scratch.rls_reference");
    if (!row) throw new Error("reference policy not found");
    return row.qual;
  });
}

export interface ColumnShape {
  type: string;
  notNull: boolean;
}

export async function columnShape(
  sql: postgres.Sql,
  schema: string,
  table: string,
  column: string,
): Promise<ColumnShape | undefined> {
  const [row] = await sql<ColumnShape[]>`
    select format_type(a.atttypid, a.atttypmod) as type, a.attnotnull as "notNull"
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relname = ${table} and a.attname = ${column} and not a.attisdropped`;
  return row;
}

// Whether a privilege manifest gives the role the command on the table, at table or column level.
export function holdsCommand(
  privileges: Partial<Record<string, readonly string[]>>,
  role: string,
  schema: string,
  table: string,
  command: string,
): boolean {
  return (privileges[role] ?? []).some(
    (privilege) =>
      privilege === `table:${schema}.${table}:${command}` ||
      (privilege.startsWith(`column:${schema}.${table}.`) && privilege.endsWith(`:${command}`)),
  );
}

// Spec Tenancy "Composite workspace foreign keys": every FK whose referencing and referenced tables are both
// tenant tables (not on the no-RLS allow-list) must hold workspace_id on both sides at the same position. FKs
// to the system tables (organization, user, billing_account) are outside the rule.
export async function compositeFkViolations(sql: postgres.Sql, schema = "public"): Promise<string[]> {
  const allowList = [...NO_RLS_ALLOW_LIST];
  const rows = await sql<{ name: string; child: string; parent: string; childAt: number | null; parentAt: number | null }[]>`
    select c.conname as name, cn.nspname || '.' || cr.relname as child, pn.nspname || '.' || pr.relname as parent,
      array_position(c.conkey, (select a.attnum from pg_attribute a
        where a.attrelid = c.conrelid and a.attname = 'workspace_id' and not a.attisdropped)) as "childAt",
      array_position(c.confkey, (select a.attnum from pg_attribute a
        where a.attrelid = c.confrelid and a.attname = 'workspace_id' and not a.attisdropped)) as "parentAt"
    from pg_constraint c
      join pg_class cr on cr.oid = c.conrelid join pg_namespace cn on cn.oid = cr.relnamespace
      join pg_class pr on pr.oid = c.confrelid join pg_namespace pn on pn.oid = pr.relnamespace
    where c.contype = 'f' and cn.nspname = ${schema}
      and not (pn.nspname = 'public' and pr.relname = any(${allowList}))
      and not (cn.nspname = 'public' and cr.relname = any(${allowList}))
    order by 1`;
  return rows
    .filter((row) => row.childAt === null || row.parentAt === null || row.childAt !== row.parentAt)
    .map((row) => `${row.child}.${row.name} -> ${row.parent}: not composite on workspace_id`);
}

// What the auth_audit_log mechanism installs (plan Task 31; migrations 0009 and 0010), as "table.trigger: function".
// T14 checks that these are exactly the triggers on the Better Auth tables and auth_audit_log.
export const AUTH_AUDIT_TRIGGERS = [
  "session.session_issued_audit: auth_audit_session_issued",
  "session.session_two_factor_check: auth_session_two_factor_check",
  "two_factor.two_factor_backup_codes_audit: auth_audit_backup_codes",
  "user.user_two_factor_changed: auth_two_factor_changed",
  "user.user_two_factor_created: auth_two_factor_changed",
  "verification.verification_refuse_trusted_device: auth_refuse_trusted_device",
] as const;

export const AUTH_AUDIT_FUNCTIONS = [
  "auth_audit_backup_codes",
  "auth_audit_session_issued",
  "auth_refuse_trusted_device",
  "auth_session_two_factor_check",
  "auth_two_factor_changed",
] as const;

// Every user trigger on the given public tables, enabled or not: "table.trigger: function (enabled)".
export async function triggersOn(sql: postgres.Sql, tables: readonly string[]): Promise<string[]> {
  const names = [...tables];
  const rows = await sql<{ trigger: string }[]>`
    select c.relname || '.' || t.tgname || ': ' || p.proname
           || case t.tgenabled when 'O' then '' else ' (enabled ' || t.tgenabled::text || ')' end as trigger
    from pg_trigger t
      join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public' and c.relname = any(${names}) and not t.tgisinternal
    order by 1`;
  return rows.map((row) => row.trigger);
}
