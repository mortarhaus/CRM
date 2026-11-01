import type { EventName, EventPayload } from "@crm/core/events";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { type Tx, withWorkspace } from "../db/workspace";
import type { Handler } from "./handlers";

export interface DomainEvent {
  id: string;
  workspaceId: string;
  name: EventName;
  version: number;
  payload: EventPayload;
}

// A core handler runs in the transaction that loaded the event, under its workspace.
export type CoreEventHandler = (event: DomainEvent, tx: Tx) => Promise<void>;
export type CoreEventHandlers = { readonly [Name in EventName]?: readonly CoreEventHandler[] };

// Empty in Phase 1: each core handler lands with its feature (spec "Domain events and jobs", Dispatch).
export const CORE_EVENT_HANDLERS: CoreEventHandlers = {};

// z.object drops keys it does not name, so job data from a later producer version still works (EVT-03).
const jobData = z.object({ workspaceId: z.uuid(), eventId: z.uuid() });

export class EventNotFoundError extends Error {
  override readonly name = "EventNotFoundError";

  constructor() {
    super("event not found");
  }
}

// The worker's domain_event handler: loads the event under the job's workspace and dispatches it. An event the
// workspace cannot see (missing, or another workspace's, hidden by RLS) fails the job, so it retries and then
// dead-letters (EVT-05).
export function domainEventHandler(handlers: CoreEventHandlers = CORE_EVENT_HANDLERS): Handler {
  return async (jobs) => {
    for (const job of jobs) {
      const parsed = jobData.safeParse(job.data);
      if (!parsed.success) throw new Error("job data is not { workspaceId, eventId }");
      const { workspaceId, eventId } = parsed.data;
      await withWorkspace(workspaceId, async (tx) => {
        const [row] = await tx.execute<{ id: string; workspace_id: string; name: EventName; version: number; payload: EventPayload }>(
          sql`select id, workspace_id, name, version, payload from domain_event where id = ${eventId}`,
        );
        if (!row) throw new EventNotFoundError();
        const event: DomainEvent = {
          id: row.id,
          workspaceId: row.workspace_id,
          name: row.name,
          version: row.version,
          payload: row.payload,
        };
        for (const handler of handlers[event.name] ?? []) await handler(event, tx);
      });
    }
  };
}
