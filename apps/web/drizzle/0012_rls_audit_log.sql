-- audit_log under the tenant policy template (plan Task 12 Step 3; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- Append-only (TEN-03, spec Scalability): crm_app holds SELECT and INSERT; crm_purge holds INSERT only, for the
-- purge's own entry (spec "crm_purge in Phase 1"). No role but the owner updates, deletes or truncates.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_log_workspace ON "audit_log" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY audit_log_app_select ON "audit_log" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY audit_log_app_insert ON "audit_log" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY audit_log_purge_insert ON "audit_log" AS PERMISSIVE FOR INSERT TO crm_purge
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "audit_log" TO crm_app;
--> statement-breakpoint
GRANT INSERT ON "audit_log" TO crm_purge;
