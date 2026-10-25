-- Polymorphic-reference trigger functions (plan Task 11, Settled item 3; spec Tenancy "Composite workspace
-- foreign keys"). Each table with a polymorphic reference attaches them in its own migration:
--   BEFORE INSERT ... EXECUTE FUNCTION public.poly_ref_check_insert('<type column>', '<id column>', '<type>=<schema.table>', ...)
--   BEFORE UPDATE ... EXECUTE FUNCTION public.poly_ref_forbid_retarget('workspace_id', '<target column>', ...)
-- SECURITY INVOKER: the target is looked up as the calling role, under RLS, and must match NEW.workspace_id.
-- (SECURITY DEFINER would not help: the owner crm_migrator has no policy and sees no tenant row under FORCE.)
-- Owned by crm_migrator, which runs this migration. Trigger functions need no EXECUTE grant to fire, so no
-- role holds one (migration 0001 already keeps EXECUTE off PUBLIC for crm_migrator's functions).
CREATE FUNCTION public.poly_ref_check_insert() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
  target_type text;
  target_table regclass;
  target_exists boolean;
BEGIN
  IF TG_WHEN <> 'BEFORE' OR TG_LEVEL <> 'ROW' OR TG_OP <> 'INSERT' OR TG_NARGS < 3 THEN
    RAISE EXCEPTION 'poly_ref: poly_ref_check_insert is a BEFORE INSERT row trigger with a type column, an id column and type=table pairs'
      USING ERRCODE = '39P01';
  END IF;
  IF NOT (row_data ? 'workspace_id' AND row_data ? TG_ARGV[0] AND row_data ? TG_ARGV[1]) THEN
    RAISE EXCEPTION 'poly_ref: trigger column missing on %', TG_TABLE_NAME USING ERRCODE = '42703';
  END IF;
  target_type := row_data ->> TG_ARGV[0];
  FOR i IN 2 .. TG_NARGS - 1 LOOP
    IF split_part(TG_ARGV[i], '=', 1) = target_type THEN
      target_table := split_part(TG_ARGV[i], '=', 2)::regclass;
      EXIT;
    END IF;
  END LOOP;
  IF target_table IS NULL THEN
    RAISE EXCEPTION 'poly_ref: unknown target type' USING ERRCODE = '23514';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE workspace_id = $1 AND id = $2)', target_table)
    INTO target_exists
    USING (row_data ->> 'workspace_id')::uuid, (row_data ->> TG_ARGV[1])::uuid;
  IF NOT target_exists THEN
    RAISE EXCEPTION 'poly_ref: target not in workspace' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.poly_ref_forbid_retarget() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  old_data jsonb := to_jsonb(OLD);
  new_data jsonb := to_jsonb(NEW);
  col text;
BEGIN
  IF TG_WHEN <> 'BEFORE' OR TG_LEVEL <> 'ROW' OR TG_OP <> 'UPDATE' OR TG_NARGS < 1 THEN
    RAISE EXCEPTION 'poly_ref: poly_ref_forbid_retarget is a BEFORE UPDATE row trigger with at least one column'
      USING ERRCODE = '39P01';
  END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF NOT (old_data ? col) THEN
      RAISE EXCEPTION 'poly_ref: trigger column missing on %', TG_TABLE_NAME USING ERRCODE = '42703';
    END IF;
    IF old_data -> col IS DISTINCT FROM new_data -> col THEN
      RAISE EXCEPTION 'poly_ref: target is immutable' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.poly_ref_check_insert() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.poly_ref_forbid_retarget() FROM PUBLIC;
