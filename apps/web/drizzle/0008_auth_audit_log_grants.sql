-- crm_app on auth_audit_log (system module, no RLS, append-only; plan Task 31 R12, TEN-03). The triggers of
-- migration 0009 run as the invoking role, so crm_app inserts the rows; nothing reads, changes or deletes them at
-- runtime. No other runtime role holds anything here.
GRANT INSERT ON "auth_audit_log" TO crm_app;
