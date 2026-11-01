-- domain_event and notification under the tenant policy template (plan Task 19 Step 1; spec Tenancy, revision 7,
-- TEN-05 to TEN-07). domain_event is append-only (TEN-03, UNI-10): crm_app inserts the event with its change and
-- reads it in the worker's handler; no role but the owner updates, deletes or truncates. notification: crm_app
-- inserts, reads and marks read (UPDATE of read_at only). crm_purge holds nothing on either.
ALTER TABLE "domain_event" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "domain_event" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY domain_event_workspace ON "domain_event" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY domain_event_app_select ON "domain_event" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY domain_event_app_insert ON "domain_event" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "domain_event" TO crm_app;
--> statement-breakpoint
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notification_workspace ON "notification" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY notification_app_select ON "notification" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY notification_app_insert ON "notification" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY notification_app_update ON "notification" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "notification" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("read_at") ON "notification" TO crm_app;
