import type { ConstructorOptions } from "pg-boss";

// The locked switches of the two pg-boss instances (spec "Domain events and jobs", §9 pg-boss rules). pg-boss is
// installed and upgraded only by crm_migrator in migrations, so neither instance migrates or creates the schema.

// The web process: crm_app, enqueue only. No maintenance, no cron, a pool of 2 (connection budget, R4).
export const SEND_BOSS_OPTIONS = {
  max: 2,
  migrate: false,
  createSchema: false,
  supervise: false,
  schedule: false,
} as const satisfies ConstructorOptions;

// The worker process: crm_worker, which fetches, completes, runs maintenance and fires schedules. No index
// rebuild (REINDEX needs ownership or MAINTAIN) and nothing persisted to the warning and queue_stats tables, so crm_worker
// holds no grant on them. Its exact grants are measured with these options (worker-grants.test.ts).
export const WORKER_BOSS_OPTIONS = {
  max: 3,
  migrate: false,
  createSchema: false,
  supervise: true,
  schedule: true,
  reindex: false,
  persistQueueStats: false,
  persistWarnings: false,
} as const satisfies ConstructorOptions;

// The retry admin command (scripts/retry-job.ts): crm_worker, one connection, no maintenance and no cron, so a
// one-off command never runs the worker's timers.
export const RETRY_BOSS_OPTIONS = {
  max: 1,
  migrate: false,
  createSchema: false,
  supervise: false,
  schedule: false,
} as const satisfies ConstructorOptions;
