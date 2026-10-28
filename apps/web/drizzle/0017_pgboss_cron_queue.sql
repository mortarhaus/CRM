-- pg-boss's internal cron queue. With schedule on, the worker's start() creates it if it is missing; the CRM creates
-- it here instead (as crm_migrator, like every queue), and the pg-boss patch (patches/pg-boss@12.35.0.patch) skips
-- the create when the queue exists, so crm_worker holds no EXECUTE on create_queue and no INSERT on pgboss.queue.
-- The options are the ones pg-boss 12.35.0 passes (policy standard, defaults otherwise), with notify off written out.
SELECT pgboss.create_queue('__pgboss__send-it', '{"policy":"standard","notify":false}'::jsonb);
