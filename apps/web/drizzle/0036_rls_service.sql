-- service under the tenant policy template (Phase 2 plan Task 21; spec Tenancy, revision 7, TEN-05 to TEN-07).
-- crm_app reads, inserts and updates a service (the catalog page), never its id, workspace_id or created_at. No DELETE:
-- a service is archived (archived_at), never deleted (plan Q22). crm_purge holds nothing here (spec line 897) but stays
-- in the RESTRICTIVE policy's role list (plan Settled item 13).
ALTER TABLE "service" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "service" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY service_workspace ON "service" AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY service_app_select ON "service" AS PERMISSIVE FOR SELECT TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY service_app_insert ON "service" AS PERMISSIVE FOR INSERT TO crm_app
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
CREATE POLICY service_app_update ON "service" AS PERMISSIVE FOR UPDATE TO crm_app
  USING (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid))
  WITH CHECK (workspace_id = (select nullif(current_setting('app.workspace_id', true), '')::uuid));
--> statement-breakpoint
GRANT SELECT, INSERT ON "service" TO crm_app;
--> statement-breakpoint
GRANT UPDATE ("name", "default_description", "default_unit_price_minor", "currency", "unit", "default_taxable", "archived_at", "version", "updated_at") ON "service" TO crm_app;
--> statement-breakpoint
-- Spec Money rules "Service currency edit" (v4.6 revision 2): a service's currency cannot change while it has a
-- default unit price; the price is cleared first (a save of its own), or a new service is made. The catalog action
-- refuses it first with CURRENCY_LOCKED; this trigger refuses it for every other path, whoever writes. The old row
-- decides: an update that clears the price and changes the currency at once is refused too, so a price is never read
-- in a currency it was not entered in. SECURITY INVOKER, owned by crm_migrator; a trigger function needs no EXECUTE
-- grant to fire, so no role holds one (migration 0001 revokes it from PUBLIC).
CREATE FUNCTION public.service_currency_locked() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.default_unit_price_minor IS NOT NULL AND NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'service: the currency cannot change while a default unit price is set'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'service_currency_locked';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER service_currency_locked BEFORE UPDATE OF currency ON "service"
  FOR EACH ROW EXECUTE FUNCTION public.service_currency_locked();
