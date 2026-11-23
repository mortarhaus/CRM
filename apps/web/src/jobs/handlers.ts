import type { Job } from "pg-boss";
import { bankDetailsEmailHandler } from "./bank-details-email";
import { idempotencyCleanupHandler, rateLimitCleanupHandler } from "./cleanup";
import { domainEventHandler } from "./domain-event";
import { emailSendHandler } from "./email-send";
import type { Log } from "./log";

// The application queues the worker works (migrations 0016, 0017 and 0032 create them). The dead-letter queues have no
// handler: a job there waits for the admin command (scripts/retry-job.ts redrives the copy back to its queue).
export const QUEUE_NAMES = [
  "domain_event",
  "email.send",
  "email.bank_details_changed",
  "rate_limit.cleanup",
  "idempotency.cleanup",
] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export interface HandlerContext {
  log: Log;
}

// A handler does tenant work through withWorkspace() and system work through src/db/system, on the worker's crm_app
// pool (openDatabase); it gets no client of its own (TEN-10).
export type Handler = (jobs: Job<object>[], context: HandlerContext) => Promise<void>;
export type Handlers = { readonly [Queue in QueueName]?: Handler };

// Each handler lands with its feature (domain_event in Task 19, the cleanups in Task 24, email.send in Task 27). A
// queue without a handler is not worked, so its jobs wait in `created`; a placeholder would complete or fail real jobs.
export const HANDLERS: Handlers = {
  domain_event: domainEventHandler(),
  "email.send": emailSendHandler(),
  "email.bank_details_changed": bankDetailsEmailHandler(),
  "rate_limit.cleanup": rateLimitCleanupHandler(),
  "idempotency.cleanup": idempotencyCleanupHandler(),
};
