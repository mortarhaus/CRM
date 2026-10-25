// The exact effective privileges of every non-owner role, checked by privileges.test.ts.
// crm_migrator owns every object and is not listed. Each entry is measured, not assumed
// (plan Settled item 2; docs/runbooks/phase-1-database-roles.md).

export type ManifestRole = "crm_app" | "crm_worker" | "crm_purge" | "crm_link_resolver" | "PUBLIC";

const table = (name: string, ...privileges: string[]) => privileges.map((privilege) => `table:public.${name}:${privilege}`);
const columns = (name: string, privilege: string, ...names: string[]) =>
  names.map((column) => `column:public.${name}.${column}:${privilege}`);

// PostgreSQL defaults kept for PUBLIC; migration 0001 revokes TEMPORARY and function EXECUTE.
const PUBLIC_DEFAULTS = ["database:CONNECT", "schema:public:USAGE"];

export const EXPECTED_PRIVILEGES: Record<ManifestRole, readonly string[]> = {
  PUBLIC: PUBLIC_DEFAULTS,
  // Better Auth tables: every statement auth.test.ts and the Phase 0 E2E suite run (2026-10-24).
  crm_app: [
    ...PUBLIC_DEFAULTS,
    ...table("user", "SELECT", "INSERT"),
    ...columns("user", "UPDATE", "name", "two_factor_enabled", "updated_at"),
    ...table("session", "SELECT", "INSERT", "DELETE"),
    ...columns("session", "UPDATE", "active_organization_id", "expires_at", "updated_at"),
    ...table("account", "SELECT", "INSERT"),
    ...table("verification", "SELECT", "INSERT", "DELETE"),
    ...table("two_factor", "SELECT", "INSERT", "DELETE"),
    ...columns("two_factor", "UPDATE", "backup_codes", "failed_verification_count", "locked_until", "secret", "verified"),
    ...table("organization", "SELECT", "INSERT"),
    ...columns("organization", "UPDATE", "name"),
    ...table("member", "SELECT", "INSERT"),
    ...table("invitation", "SELECT", "INSERT"),
    ...columns("invitation", "UPDATE", "expires_at", "status"),
    // Tenant tables, under RLS (migration 0003).
    ...table("workspace_settings", "SELECT", "INSERT", "UPDATE"),
  ],
  crm_worker: PUBLIC_DEFAULTS,
  crm_purge: PUBLIC_DEFAULTS,
  crm_link_resolver: PUBLIC_DEFAULTS,
};
