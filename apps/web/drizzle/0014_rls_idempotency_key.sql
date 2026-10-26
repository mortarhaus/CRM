-- idempotency_key under the tenant policy template (plan Task 14 Step 1; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- crm_app claims a key (INSERT), reads it on a repeat (SELECT), stores the handler's response (UPDATE of response
-- only) and removes expired keys (DELETE: action() before a claim, the cleanup job from plan Task 24).
-- crm_purge holds nothing here.
ALTER TABLE "idempotency_key" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "idempotency_key" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY idempotency_key_workspace ON "idempotency_key" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY idempotency_key_app_select ON "idempotency_key" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY idempotency_key_app_insert ON "idempotency_key" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY idempotency_key_app_update ON "idempotency_key" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY idempotency_key_app_delete ON "idempotency_key" AS PERMISSIVE FOR DELETE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "idempotency_key" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("response") ON "idempotency_key" TO crm_app;
