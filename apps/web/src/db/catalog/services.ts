import { and, asc, eq, isNotNull, isNull, type SQL, sql } from "drizzle-orm";
import { recordAudit } from "../../lib/audit";
import { service } from "../schema";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../workspace";

export type Service = typeof service.$inferSelect;

// What a person sets on a service (the catalog form); the price is in minor units of the currency.
export interface ServiceFields {
  name: string;
  defaultDescription: string | null;
  defaultUnitPriceMinor: bigint | null;
  currency: string;
  unit: string | null;
  defaultTaxable: boolean;
}

export class StaleServiceError extends Error {
  constructor() {
    super("service changed since it was read");
    this.name = "StaleServiceError";
  }
}

export class ServiceNotFoundError extends Error {
  constructor() {
    super("no such service in this workspace");
    this.name = "ServiceNotFoundError";
  }
}

// Spec Money rules "Service currency edit": the price is cleared first (migration 0036 refuses it in the database too).
export class CurrencyLockedError extends Error {
  constructor() {
    super("the currency cannot change while a default unit price is set");
    this.name = "CurrencyLockedError";
  }
}

function workspaceId(): string {
  const id = currentWorkspaceId();
  if (id === undefined) throw new NoWorkspaceError();
  return id;
}

// The audit entry's view of a service: the price as a decimal string of minor units (MON-03), never a Number.
const audited = (row: Service) => ({
  name: row.name,
  default_description: row.defaultDescription,
  default_unit_price_minor: row.defaultUnitPriceMinor === null ? null : row.defaultUnitPriceMinor.toString(),
  currency: row.currency,
  unit: row.unit,
  default_taxable: row.defaultTaxable,
  archived_at: row.archivedAt === null ? null : row.archivedAt.toISOString(),
  version: row.version,
});

// The workspace's services, A to Z: the active ones, or with archived the archived ones only (plan Q22).
export function listServices(tx: Tx, options: { archived: boolean }): Promise<Service[]> {
  return tx
    .select()
    .from(service)
    .where(and(eq(service.workspaceId, workspaceId()), options.archived ? isNotNull(service.archivedAt) : isNull(service.archivedAt)))
    .orderBy(asc(service.name), asc(service.id));
}

// One service of the transaction's workspace, or null (RLS shows no other; the filter says so too).
export async function findService(tx: Tx, id: string, options: { forUpdate?: boolean } = {}): Promise<Service | null> {
  const query = tx
    .select()
    .from(service)
    .where(and(eq(service.workspaceId, workspaceId()), eq(service.id, id)));
  const [row] = options.forUpdate ? await query.for("update") : await query;
  return row ?? null;
}

export async function createService(tx: Tx, fields: ServiceFields, actorUserId: string): Promise<Service> {
  const [created] = await tx
    .insert(service)
    .values({ workspaceId: workspaceId(), ...fields })
    .returning();
  if (!created) throw new Error("service not created");
  await recordAudit(tx, { actorUserId, action: "service.created", targetType: "service", targetId: created.id, after: audited(created) });
  return created;
}

// The row as the caller read it (version), locked for the change. ServiceNotFoundError, StaleServiceError.
async function lockedAt(tx: Tx, id: string, expectedVersion: number): Promise<Service> {
  const current = await findService(tx, id, { forUpdate: true });
  if (!current) throw new ServiceNotFoundError();
  if (current.version !== expectedVersion) throw new StaleServiceError();
  return current;
}

async function write(tx: Tx, current: Service, patch: Partial<ServiceFields> & { archivedAt?: SQL | null }, actorUserId: string, action: string) {
  const [updated] = await tx
    .update(service)
    .set({ ...patch, version: sql`${service.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(service.workspaceId, current.workspaceId), eq(service.id, current.id)))
    .returning();
  if (!updated) throw new StaleServiceError();
  await recordAudit(tx, { actorUserId, action, targetType: "service", targetId: current.id, before: audited(current), after: audited(updated) });
  return updated;
}

// An edit, to the version the caller read. A currency change while the stored row has a default price is refused
// (CurrencyLockedError), even when the same save clears the price. An unchanged save writes nothing.
export async function updateService(tx: Tx, id: string, fields: ServiceFields, expectedVersion: number, actorUserId: string): Promise<Service> {
  const current = await lockedAt(tx, id, expectedVersion);
  if (current.defaultUnitPriceMinor !== null && fields.currency !== current.currency) throw new CurrencyLockedError();
  const unchanged = (Object.keys(fields) as (keyof ServiceFields)[]).every((key) => fields[key] === current[key]);
  if (unchanged) return current;
  return write(tx, current, fields, actorUserId, "service.updated");
}

// Archive (hidden from the default list, kept for documents that name it) or restore. Never a delete (plan Q22).
// Archiving an archived service, or restoring an active one, writes nothing.
export async function setServiceArchived(tx: Tx, id: string, archived: boolean, expectedVersion: number, actorUserId: string): Promise<Service> {
  const current = await lockedAt(tx, id, expectedVersion);
  if ((current.archivedAt !== null) === archived) return current;
  return write(tx, current, { archivedAt: archived ? sql`now()` : null }, actorUserId, archived ? "service.archived" : "service.unarchived");
}
