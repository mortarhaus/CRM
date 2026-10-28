-- crm_worker: the worker's pg-boss instance (fetch, complete, fail, retry, maintenance, cron), pgboss schema only.
-- Measured 2026-10-27 on pg-boss 12.35.0 (patched) and PostgreSQL 17 by deny-and-add and ablation
-- (apps/web/src/jobs/worker-grants.test.ts; docs/runbooks/phase-1-database-roles.md "pg-boss grants"). Nothing in
-- public (TEN-02). No EXECUTE on create_queue and no INSERT on pgboss.queue: queues are created only in migrations
-- (0016, 0017), and the pg-boss patch stops the worker's start() from creating the cron queue. UPDATE on queue and
-- version is limited to pg-boss's bookkeeping columns, so queue options (notify included) and the schema version
-- change only in migrations.
GRANT USAGE ON SCHEMA pgboss TO crm_worker;
GRANT EXECUTE ON FUNCTION pgboss.job_now() TO crm_worker;
GRANT SELECT ON pgboss.version, pgboss.queue, pgboss.schedule TO crm_worker;
GRANT UPDATE (cron_on, flow_on, monitor_backoff_on) ON pgboss.version TO crm_worker;
GRANT UPDATE (
  monitor_claim_on, monitor_on, maintain_on,
  deferred_count, queued_count, ready_count, active_count, failed_count, total_count,
  singletons_active, ready_history
) ON pgboss.queue TO crm_worker;
GRANT INSERT, UPDATE, DELETE ON pgboss.schedule TO crm_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON pgboss.job_common TO crm_worker;
GRANT SELECT, INSERT, UPDATE ON pgboss.job TO crm_worker;
GRANT SELECT, DELETE ON pgboss.job_dependency TO crm_worker;
