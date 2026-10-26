-- Trusted devices are off (plan Task 31 R9): a trusted-device record would let a later sign-in skip the 2FA step
-- with no two_factor_verified row. The input check refuses `trustDevice` (src/lib/auth/input-limits.ts); this
-- refuses the record itself for any writer, then removes the Phase 0 records so none is honoured after the upgrade.
-- crm_app holds no UPDATE on verification, so an insert is the only way one can appear.
CREATE FUNCTION public.auth_refuse_trusted_device() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'auth: trusted devices are disabled' USING ERRCODE = '23514';
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_refuse_trusted_device() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER verification_refuse_trusted_device BEFORE INSERT ON public.verification FOR EACH ROW
  WHEN (NEW.identifier LIKE 'trust-device-%')
  EXECUTE FUNCTION public.auth_refuse_trusted_device();
--> statement-breakpoint
DELETE FROM public.verification WHERE identifier LIKE 'trust-device-%';
