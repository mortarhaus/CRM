-- Phase 1 queues (plan Task 16). Queue options, notify included, change only in a migration (spec "Domain events and
-- jobs"; R7). Option keys are the ones pgboss.create_queue reads in pg-boss 12.35.0. Dead-letter queues come first:
-- queue.dead_letter references queue(name). Retries 5, first delay 30 s, backoff on: builder operational defaults
-- (docs/DECISIONS.md 2026-10-27). No queue is partitioned, so every job is a row of pgboss.job_common.
SELECT pgboss.create_queue('domain_event.dead', '{"policy":"standard","notify":false}'::jsonb);
SELECT pgboss.create_queue('email.send.dead', '{"policy":"standard","notify":false}'::jsonb);
SELECT pgboss.create_queue('domain_event', '{"policy":"standard","retryLimit":5,"retryDelay":30,"retryBackoff":true,"deadLetter":"domain_event.dead","notify":false}'::jsonb);
SELECT pgboss.create_queue('email.send', '{"policy":"standard","retryLimit":5,"retryDelay":30,"retryBackoff":true,"deadLetter":"email.send.dead","notify":false}'::jsonb);
SELECT pgboss.create_queue('rate_limit.cleanup', '{"policy":"singleton","notify":false}'::jsonb);
SELECT pgboss.create_queue('idempotency.cleanup', '{"policy":"singleton","notify":false}'::jsonb);

-- crm_app: the web send-only instance (enqueue only; spec "pgboss grants"). Measured 2026-10-27 (install.test.ts):
-- start() reads version and queue, send() inserts into job_common, returns the id and calls job_now(). start_after is
-- the spec's grant for a queue with notify on; no Phase 1 queue has it (docs/DECISIONS.md 2026-10-27).
GRANT USAGE ON SCHEMA pgboss TO crm_app;
GRANT SELECT ON pgboss.version, pgboss.queue TO crm_app;
GRANT INSERT, SELECT (id, start_after) ON pgboss.job_common TO crm_app;
GRANT EXECUTE ON FUNCTION pgboss.job_now() TO crm_app;
