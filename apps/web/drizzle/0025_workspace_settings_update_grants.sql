-- crm_app UPDATE on workspace_settings per column (Phase 2 plan Task 4; the Phase 1 per-column pattern of 0022/0023).
-- Migration 0003 granted UPDATE on the whole table; it is replaced by the settings columns plus version and updated_at
-- (optimistic concurrency, db/settings/workspace-settings.ts). workspace_id and created_at are never updated.
-- SELECT and INSERT stay as 0003 granted them, the RLS policies of 0003 are unchanged, and crm_purge holds nothing
-- here (spec line 897: the purge must not read workspace_settings).
REVOKE UPDATE ON "workspace_settings" FROM crm_app;
--> statement-breakpoint
GRANT UPDATE (
  "short_code", "logo_key", "brand_colour",
  "address_line1", "address_line2", "address_city", "address_postcode", "address_state",
  "country", "timezone", "locale", "date_format", "base_currency", "default_currency",
  "tax_registered", "tax_registration_no", "own_tin", "own_brn", "default_tax_name", "default_tax_rate_bps", "tax_rounding",
  "email_from_name", "email_reply_to", "email_bcc_self", "auto_send_default", "default_agreement_pattern", "require_2fa",
  "version", "updated_at"
) ON "workspace_settings" TO crm_app;
