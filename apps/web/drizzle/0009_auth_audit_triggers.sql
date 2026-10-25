-- The writers of auth_audit_log and the session rules of plan Task 31 (spec "Audit, logging, privacy" and
-- "Authentication and sessions", AUTH-07). Each row is written by a trigger, in the statement that makes the change
-- it records, as the invoking role (crm_app holds INSERT only, migration 0008); the client IP is the request's
-- crm.auth_client_ip (src/db/system/auth-transaction.ts). SECURITY INVOKER, owned by crm_migrator, which runs this
-- migration; trigger functions need no EXECUTE grant to fire, so no role holds one.
--
-- Cutover from Phase 0 first (R15): no Phase 0 session has an audit row. session stays locked against writes until
-- the migration commits, every session is deleted, and only then do the triggers exist. No audit row is written.
LOCK TABLE public.session IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DELETE FROM public.session;
--> statement-breakpoint
-- One session row, its audit rows: a completed sign-in is exactly one session_issued row with reason sign_in (its
-- 2FA step one two_factor_verified row before it), the password step of a 2FA sign-in and a rotation are recorded as
-- what they are. A session whose issue_reason is not a known label is refused, so none exists without its rows.
CREATE FUNCTION public.auth_audit_session_issued() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  client_ip text := nullif(current_setting('crm.auth_client_ip', true), '');
  issued jsonb;
BEGIN
  CASE NEW.issue_reason
    WHEN 'password' THEN issued := jsonb_build_object('reason', 'sign_in', 'method', 'password');
    WHEN 'password_two_factor' THEN issued := jsonb_build_object('reason', 'two_factor_pending', 'method', 'password');
    WHEN 'two_factor_totp' THEN issued := jsonb_build_object('reason', 'sign_in', 'method', 'totp');
    WHEN 'two_factor_backup_code' THEN issued := jsonb_build_object('reason', 'sign_in', 'method', 'backup_code');
    WHEN 'rotation_two_factor_enabled' THEN issued := jsonb_build_object('reason', 'rotation', 'cause', 'two_factor_enabled');
    WHEN 'rotation_two_factor_disabled' THEN issued := jsonb_build_object('reason', 'rotation', 'cause', 'two_factor_disabled');
    WHEN 'rotation_backup_codes_regenerated' THEN
      issued := jsonb_build_object('reason', 'rotation', 'cause', 'backup_codes_regenerated');
    WHEN 'rotation_password_changed' THEN issued := jsonb_build_object('reason', 'rotation', 'cause', 'password_changed');
    ELSE
      RAISE EXCEPTION 'auth_audit: session without a known issue reason' USING ERRCODE = '23514';
  END CASE;
  IF issued ->> 'reason' = 'sign_in' AND issued ->> 'method' <> 'password' THEN
    INSERT INTO public.auth_audit_log (user_id, event, detail, ip, created_at)
      VALUES (NEW.user_id, 'two_factor_verified', jsonb_build_object('method', issued ->> 'method', 'session_id', NEW.id),
        client_ip, clock_timestamp());
  END IF;
  INSERT INTO public.auth_audit_log (user_id, event, detail, ip, created_at)
    VALUES (NEW.user_id, 'session_issued', issued || jsonb_build_object('session_id', NEW.id), client_ip, clock_timestamp());
  RETURN NULL;
END
$$;
--> statement-breakpoint
-- A sign-in session is stored only under the 2FA state its label was decided on (password: off; password_two_factor:
-- on). The request already holds the user row (lockAuthUsers); this also holds for any writer that does not.
CREATE FUNCTION public.auth_session_two_factor_check() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  enabled boolean;
BEGIN
  SELECT coalesce(u.two_factor_enabled, false) INTO enabled FROM public."user" u WHERE u.id = NEW.user_id FOR SHARE;
  IF enabled IS DISTINCT FROM (NEW.issue_reason = 'password_two_factor') THEN
    RAISE EXCEPTION 'auth_audit: 2FA state changed during sign-in' USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
-- Enabling or disabling 2FA is recorded, and ends every session the user had (AUTH-07, R5); Better Auth then
-- inserts the changer's replacement session, after this statement. In the request transaction an interrupted or
-- failed change rolls back with its revocation, so no failure leaves the user without a session to retry (R11).
CREATE FUNCTION public.auth_two_factor_changed() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.auth_audit_log (user_id, event, ip, created_at)
    VALUES (NEW.id, CASE WHEN NEW.two_factor_enabled THEN 'two_factor_enabled' ELSE 'two_factor_disabled' END,
      nullif(current_setting('crm.auth_client_ip', true), ''), clock_timestamp());
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.session WHERE user_id = NEW.id;
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
-- A change of an enrolled user's recovery codes: a regeneration or a code used to sign in. The database cannot tell
-- them apart (both write the whole set), so both are this one event. The codes of an enrolment still in progress
-- (verified false before and after: a restart writes new ones) are not yet a user's codes and are not recorded.
CREATE FUNCTION public.auth_audit_backup_codes() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.auth_audit_log (user_id, event, ip, created_at)
    VALUES (NEW.user_id, 'two_factor_backup_codes_changed', nullif(current_setting('crm.auth_client_ip', true), ''),
      clock_timestamp());
  RETURN NULL;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_audit_session_issued() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_session_two_factor_check() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_two_factor_changed() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.auth_audit_backup_codes() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER session_two_factor_check BEFORE INSERT ON public.session FOR EACH ROW
  WHEN (NEW.issue_reason IN ('password', 'password_two_factor'))
  EXECUTE FUNCTION public.auth_session_two_factor_check();
--> statement-breakpoint
CREATE TRIGGER session_issued_audit AFTER INSERT ON public.session FOR EACH ROW
  EXECUTE FUNCTION public.auth_audit_session_issued();
--> statement-breakpoint
CREATE TRIGGER user_two_factor_changed AFTER UPDATE OF two_factor_enabled ON public."user" FOR EACH ROW
  WHEN (coalesce(OLD.two_factor_enabled, false) IS DISTINCT FROM coalesce(NEW.two_factor_enabled, false))
  EXECUTE FUNCTION public.auth_two_factor_changed();
--> statement-breakpoint
CREATE TRIGGER user_two_factor_created AFTER INSERT ON public."user" FOR EACH ROW
  WHEN (coalesce(NEW.two_factor_enabled, false))
  EXECUTE FUNCTION public.auth_two_factor_changed();
--> statement-breakpoint
CREATE TRIGGER two_factor_backup_codes_audit AFTER UPDATE OF backup_codes ON public.two_factor FOR EACH ROW
  WHEN (OLD.backup_codes IS DISTINCT FROM NEW.backup_codes AND (OLD.verified IS NOT FALSE OR NEW.verified IS NOT FALSE))
  EXECUTE FUNCTION public.auth_audit_backup_codes();
