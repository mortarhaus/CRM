-- crm_app on rate_limit (system module, no RLS; plan Task 21 Step 2). The consume statement inserts or updates a
-- counter and reads it back, the give-back updates the count, and the daily cleanup deletes ended windows. No other
-- runtime role holds anything here.
GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit" TO crm_app;
