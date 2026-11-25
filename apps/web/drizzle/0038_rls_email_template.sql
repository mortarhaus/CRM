-- email_template under the tenant policy template (Phase 2 plan Task 23; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- crm_app reads a template, inserts it (the first save) and updates its subject and body (a save, or restoring the
-- default), never its workspace_id, event or created_at. No DELETE: restoring the default writes the default text.
-- crm_purge holds nothing here (spec line 897) but stays in the RESTRICTIVE policy's role list (plan Settled item 13).
ALTER TABLE "email_template" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "email_template" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY email_template_workspace ON "email_template" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY email_template_app_select ON "email_template" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY email_template_app_insert ON "email_template" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY email_template_app_update ON "email_template" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "email_template" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("subject", "body", "version", "updated_at") ON "email_template" TO crm_app;
