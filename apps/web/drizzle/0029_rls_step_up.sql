-- step_up under the tenant policy template (Phase 2 plan Task 13, Q15 = A; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- crm_app inserts a session's verification, reads it, and overwrites verified_at on the next one (UPDATE of
-- verified_at only). No DELETE: rows of ended sessions stay until a retention sweep (plan Task 13). crm_purge holds
-- nothing here but stays in the RESTRICTIVE policy's role list (plan Settled item 13).
ALTER TABLE "step_up" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "step_up" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY step_up_workspace ON "step_up" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY step_up_app_select ON "step_up" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY step_up_app_insert ON "step_up" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY step_up_app_update ON "step_up" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "step_up" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("verified_at") ON "step_up" TO crm_app;
