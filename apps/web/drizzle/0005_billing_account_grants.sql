-- crm_app on billing_account (system module, no RLS; plan Task 9 Step 3). The organization before-create hook
-- inserts the owner's account once and reads it after. No UPDATE or DELETE: plan and status are locked switches
-- until Part 3. No other runtime role holds anything here.
GRANT SELECT, INSERT ON "billing_account" TO crm_app;
