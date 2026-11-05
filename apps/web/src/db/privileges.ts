// The exact effective privileges of every non-owner role, checked by privileges.test.ts.
// crm_migrator owns every object and is not listed. Each entry is measured, not assumed
// (plan Settled item 2; docs/runbooks/phase-1-database-roles.md).

export type ManifestRole = "crm_app" | "crm_worker" | "crm_purge" | "crm_link_resolver" | "PUBLIC";

// A bare table name is in schema public; other schemas are written out ("pgboss.job_common").
const qualified = (name: string) => (name.includes(".") ? name : `public.${name}`);
const table = (name: string, ...privileges: string[]) =>
  privileges.map((privilege) => `table:${qualified(name)}:${privilege}`);
const columns = (name: string, privilege: string, ...names: string[]) =>
  names.map((column) => `column:${qualified(name)}.${column}:${privilege}`);

// Every workspace_settings column crm_app may UPDATE (migration 0025).
const WORKSPACE_SETTINGS_UPDATE_COLUMNS = [
  "short_code",
  "logo_key",
  "brand_colour",
  "address_line1",
  "address_line2",
  "address_city",
  "address_postcode",
  "address_state",
  "country",
  "timezone",
  "locale",
  "date_format",
  "base_currency",
  "default_currency",
  "tax_registered",
  "tax_registration_no",
  "own_tin",
  "own_brn",
  "default_tax_name",
  "default_tax_rate_bps",
  "tax_rounding",
  "email_from_name",
  "email_reply_to",
  "email_bcc_self",
  "auto_send_default",
  "default_agreement_pattern",
  "require_2fa",
  "version",
  "updated_at",
];

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
    ...columns("account", "UPDATE", "password", "updated_at"), // the password change (migration 0023)
    ...table("verification", "SELECT", "INSERT", "DELETE"),
    ...table("two_factor", "SELECT", "INSERT", "DELETE"),
    ...columns("two_factor", "UPDATE", "backup_codes", "failed_verification_count", "locked_until", "secret", "verified"),
    ...table("organization", "SELECT", "INSERT"),
    ...columns("organization", "UPDATE", "name"),
    ...table("member", "SELECT", "INSERT"),
    ...table("invitation", "SELECT", "INSERT"),
    ...columns("invitation", "UPDATE", "expires_at", "status"),
    ...table("billing_account", "SELECT", "INSERT"), // system table, no RLS (migration 0005)
    ...table("auth_audit_log", "INSERT"), // system table, no RLS, append-only, no reader (migration 0008)
    ...table("rate_limit", "SELECT", "INSERT", "UPDATE", "DELETE"), // system table, no RLS (migration 0022)
    // Tenant tables, under RLS (migrations 0003, 0012, 0014 and 0020).
    ...table("workspace_settings", "SELECT", "INSERT"),
    // Per column since migration 0025: never workspace_id or created_at.
    ...columns("workspace_settings", "UPDATE", ...WORKSPACE_SETTINGS_UPDATE_COLUMNS),
    ...table("audit_log", "SELECT", "INSERT"), // append-only (TEN-03)
    ...table("idempotency_key", "SELECT", "INSERT", "DELETE"),
    ...columns("idempotency_key", "UPDATE", "response"),
    ...table("domain_event", "SELECT", "INSERT"), // append-only event history (TEN-03)
    ...table("notification", "SELECT", "INSERT"),
    ...columns("notification", "UPDATE", "read_at"),
    // The web send-only pg-boss instance: enqueue only, never a payload column (migration 0016, install.test.ts).
    "schema:pgboss:USAGE",
    ...table("pgboss.version", "SELECT"),
    ...table("pgboss.queue", "SELECT"),
    ...table("pgboss.job_common", "INSERT"),
    ...columns("pgboss.job_common", "SELECT", "id", "start_after"),
    "function:pgboss.job_now():EXECUTE",
  ],
  // The worker's pg-boss instance, pgboss schema only, nothing in public (TEN-02; migration 0018, measured and
  // ablated in jobs/worker-grants.test.ts). No create_queue, no INSERT on pgboss.queue (the pg-boss patch, UNI-06).
  crm_worker: [
    ...PUBLIC_DEFAULTS,
    "schema:pgboss:USAGE",
    "function:pgboss.job_now():EXECUTE",
    ...table("pgboss.version", "SELECT"),
    ...columns("pgboss.version", "UPDATE", "cron_on", "flow_on", "monitor_backoff_on"),
    ...table("pgboss.queue", "SELECT"),
    ...columns(
      "pgboss.queue",
      "UPDATE",
      "monitor_claim_on",
      "monitor_on",
      "maintain_on",
      "deferred_count",
      "queued_count",
      "ready_count",
      "active_count",
      "failed_count",
      "total_count",
      "singletons_active",
      "ready_history",
    ),
    ...table("pgboss.schedule", "SELECT", "INSERT", "UPDATE", "DELETE"),
    ...table("pgboss.job_common", "SELECT", "INSERT", "UPDATE", "DELETE"),
    ...table("pgboss.job", "SELECT", "INSERT", "UPDATE"),
    ...table("pgboss.job_dependency", "SELECT", "DELETE"),
  ],
  // Phase 1 part (b1): INSERT on audit_log only, for the purge's own entry (spec "crm_purge in Phase 1").
  crm_purge: [...PUBLIC_DEFAULTS, ...table("audit_log", "INSERT")],
  crm_link_resolver: PUBLIC_DEFAULTS,
};
