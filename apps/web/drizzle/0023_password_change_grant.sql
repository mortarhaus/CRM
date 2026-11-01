-- crm_app may change a password (plan Task 24; spec "Enabled in Phase 1": /change-password). Better Auth 1.7.14's
-- change-password updates exactly these two columns of the credential account (internalAdapter.updateAccount sets
-- the password and updated_at). Every change also revokes the user's other sessions (AUTH-07; input-limits.ts).
GRANT UPDATE (password, updated_at) ON "account" TO crm_app;
