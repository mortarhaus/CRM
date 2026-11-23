-- The owner email on a bank-details or payment QR change (Phase 2 PR 5c, plan Task 16). A new email kind gets its own
-- queue (docs/DECISIONS.md 2026-11-01: email.send is the test email only), with the options of email.send (migration
-- 0016): retries 5, first delay 30 s, backoff on, then its own dead-letter queue, which no worker works (redrive it
-- with the retry admin command). Dead-letter queue first: queue.dead_letter references queue(name). The crm_app and
-- crm_worker grants are on the pgboss tables, not per queue (0016, 0018), so none changes.
SELECT pgboss.create_queue('email.bank_details_changed.dead', '{"policy":"standard","notify":false}'::jsonb);
SELECT pgboss.create_queue('email.bank_details_changed', '{"policy":"standard","retryLimit":5,"retryDelay":30,"retryBackoff":true,"deadLetter":"email.bank_details_changed.dead","notify":false}'::jsonb);
