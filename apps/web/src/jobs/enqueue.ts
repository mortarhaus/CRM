import { createHash } from "node:crypto";
import { type EventName, type EventPayload, MINOR_UNITS_PATTERN } from "@crm/core/events";
import { sql } from "drizzle-orm";
import { fromDrizzle } from "pg-boss";
import { z } from "zod";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../db/workspace";
import { getSendBoss } from "./boss";
import type { QueueName } from "./handlers";

// The only path from app code to a pg-boss send (plan Task 19). Every job is sent in the caller's withWorkspace()
// transaction through fromDrizzle(tx, sql), so a rolled-back change leaves no job and the job is invisible to other
// connections until commit (EVT-01; spec "Domain events and jobs", Spike 2). Errors name the field, never the value
// (UNI-09).

export class EventPayloadError extends Error {
  override readonly name = "EventPayloadError";
}

export class JobDataError extends Error {
  override readonly name = "JobDataError";
}

// An event payload value: a uuid, an amount in minor units as a canonical decimal string (MON-03), or a safe integer.
export const eventPayloadSchema = z.record(
  z.string(),
  z.union([z.uuid(), z.string().regex(MINOR_UNITS_PATTERN), z.number().int().safe()]),
);

// Job data holds IDs only (PROJECT.md §9; plan Settled item 5): workspaceId and other <name>Id keys, uuid values.
export type JobData = Readonly<Record<`${string}Id`, string>>;
export const jobDataSchema = z
  .record(z.string().regex(/^[a-z][A-Za-z]*Id$/), z.uuid())
  .refine((data) => "workspaceId" in data, { path: ["workspaceId"] });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertEventPayload(payload: unknown): asserts payload is EventPayload {
  if (!isPlainObject(payload)) throw new EventPayloadError("payload is not an object");
  const result = eventPayloadSchema.safeParse(payload);
  if (result.success) return;
  const field = String(result.error.issues[0]?.path[0] ?? "");
  if (typeof payload[field] === "bigint") {
    throw new EventPayloadError(`payload.${field} is a bigint; encode money with minorUnits()`);
  }
  throw new EventPayloadError(`payload.${field} is not an ID or amount`);
}

export function assertJobData(data: unknown): asserts data is JobData {
  if (!isPlainObject(data)) throw new JobDataError("job is not an object");
  const result = jobDataSchema.safeParse(data);
  if (!result.success) throw new JobDataError(`job.${String(result.error.issues[0]?.path[0] ?? "")} is not an ID`);
}

async function send(tx: Tx, queue: QueueName, data: JobData, id?: string): Promise<string | null> {
  assertJobData(data);
  const boss = await getSendBoss();
  return boss.send(queue, data, { db: fromDrizzle(tx, sql), ...(id ? { id } : {}) });
}

// A job that is not a domain event (email.send), in the caller's transaction. With an id (stableJobId), a repeated
// send of the same job creates one job and answers null.
export function enqueueJob(
  tx: Tx,
  queue: Exclude<QueueName, "domain_event">,
  data: JobData,
  options: { id?: string } = {},
): Promise<string | null> {
  return send(tx, queue, data, options.id);
}

// A job id that is the same for the same IDs: a SHA-256 of them, written as an RFC 9562 version 8 UUID (pg-boss job
// ids are uuids).
export function stableJobId(...ids: readonly string[]): string {
  const hex = createHash("sha256").update(ids.join(":")).digest("hex");
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// One domain_event row and its job, whose id is the event id, so a repeated send creates one job. The workspace is
// the transaction's (TEN-11); the payload is checked before any statement.
export async function emitEvent(
  tx: Tx,
  event: { name: EventName; version: number; payload: EventPayload },
): Promise<string> {
  assertEventPayload(event.payload);
  if (currentWorkspaceId() === undefined) throw new NoWorkspaceError();
  const [row] = await tx.execute<{ id: string; workspace_id: string }>(sql`
    insert into domain_event (workspace_id, name, version, payload)
    values (
      (select nullif(current_setting('app.workspace_id', true), '')::uuid),
      ${event.name}, ${event.version}, ${JSON.stringify(event.payload)}::jsonb
    )
    returning id, workspace_id`);
  if (!row) throw new Error("domain_event row not inserted");
  await send(tx, "domain_event", { workspaceId: row.workspace_id, eventId: row.id }, row.id);
  return row.id;
}
