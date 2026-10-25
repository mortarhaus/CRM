-- workspace_settings under the tenant policy template (plan Global Constraints; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- crm_app holds SELECT, INSERT and UPDATE; no DELETE (workspace deletion is Phase 9). crm_purge holds nothing here.
ALTER TABLE "workspace_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspace_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY workspace_settings_workspace ON "workspace_settings" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY workspace_settings_app_select ON "workspace_settings" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY workspace_settings_app_insert ON "workspace_settings" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY workspace_settings_app_update ON "workspace_settings" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "workspace_settings" TO crm_app;
