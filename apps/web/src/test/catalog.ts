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
