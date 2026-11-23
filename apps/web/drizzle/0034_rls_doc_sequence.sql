-- doc_sequence under the tenant policy template (Phase 2 plan Task 18; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- crm_app reads the row, inserts it (onboarding seeds the invoice sequence), and updates the counter and its period
-- (allocateNumber) and the pattern and reset rule (settings), never workspace_id, doc_type or created_at. No DELETE: a
-- counter is never removed, so a number can never be given twice. crm_purge holds nothing here (spec line 897) but
-- stays in the RESTRICTIVE policy's role list (plan Settled item 13).
ALTER TABLE "doc_sequence" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "doc_sequence" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY doc_sequence_workspace ON "doc_sequence" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY doc_sequence_app_select ON "doc_sequence" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY doc_sequence_app_insert ON "doc_sequence" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY doc_sequence_app_update ON "doc_sequence" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "doc_sequence" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("pattern", "reset_rule", "counter", "last_reset_period", "version", "updated_at") ON "doc_sequence" TO crm_app;
