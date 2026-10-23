-- Phase 1 privilege baseline (plan Task 3, Settled item 2). Runs as crm_migrator, the database owner.
-- No project or pg-boss function is executable through PUBLIC; EXECUTE is granted per function.
ALTER DEFAULT PRIVILEGES FOR ROLE crm_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
-- No role needs temporary tables, and crm_purge's allow-list does not include them.
DO $$ BEGIN EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC', current_database()); END $$;
--> statement-breakpoint
-- crm_app on the Better Auth tables (system module, no RLS): the measured set (plan Task 3 Step 4,
-- docs/runbooks/phase-1-database-roles.md). UPDATE is per column: only the columns Better Auth writes.
GRANT SELECT, INSERT ON "user" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("name", "two_factor_enabled", "updated_at") ON "user" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "session" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("active_organization_id", "expires_at", "updated_at") ON "session" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "account" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "verification" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "two_factor" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("backup_codes", "failed_verification_count", "locked_until", "secret", "verified") ON "two_factor" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "organization" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("name") ON "organization" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "member" TO crm_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "invitation" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("expires_at", "status") ON "invitation" TO crm_app;
