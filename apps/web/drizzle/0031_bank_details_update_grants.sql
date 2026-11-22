-- crm_app UPDATE on the bank-detail columns of workspace_settings added by 0030 (Phase 2 PR 5b, plan Task 14), per
-- column as in 0025. Who may change them (the Owner, with step-up) is the action's rule (spec lines 788 and 798).
-- crm_purge still holds nothing here (spec line 897).
GRANT UPDATE (
  "bank_name", "bank_account_holder", "bank_account_number", "bank_swift_code", "duitnow_qr_key", "bank_details_changed_at"
) ON "workspace_settings" TO crm_app;
