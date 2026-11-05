import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { recordAudit } from "../../lib/audit";
import { workspaceSettings } from "../schema";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../workspace";

export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;

// What a settings action may change: never the key, the version or the timestamps.
export type SettingsPatch = Partial<Omit<WorkspaceSettings, "workspaceId" | "version" | "createdAt" | "updatedAt">>;

// Fields that can hold personal data (a sole trader's address, own TIN or registration numbers, a person's name or
// email address): stored in the audit entry as "[pii]" (spec "Audit, logging, privacy"). By column name.
const PII_COLUMNS = [
  "address_line1",
  "address_line2",
  "address_city",
  "address_postcode",
  "address_state",
  "tax_registration_no",
  "own_tin",
  "own_brn",
  "email_from_name",
  "email_reply_to",
] as const;

const COLUMNS = getTableColumns(workspaceSettings);

export class StaleSettingsError extends Error {
  constructor() {
    super("workspace_settings changed since it was read");
    this.name = "StaleSettingsError";
  }
}

function workspaceId(): string {
  const id = currentWorkspaceId();
  if (id === undefined) throw new NoWorkspaceError();
  return id;
}

// The transaction's workspace row (RLS shows no other; the filter says so too). action() heals a missing row first.
export async function getSettings(tx: Tx, options: { forUpdate?: boolean } = {}): Promise<WorkspaceSettings> {
  const query = tx.select().from(workspaceSettings).where(eq(workspaceSettings.workspaceId, workspaceId()));
  const [row] = options.forUpdate ? await query.for("update") : await query;
  if (!row) throw new Error("workspace_settings row missing");
  return row;
}

// The colour the app layout renders on every page; null when unset or when the row is still to be healed (the
// layout must not fail where getSettings would throw).
export async function findBrandColour(tx: Tx): Promise<string | null> {
  const [row] = await tx
    .select({ brandColour: workspaceSettings.brandColour })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId()));
  return row?.brandColour ?? null;
}

// Optimistic concurrency: the patch applies only to the version the caller read, which becomes version + 1. The row
// is locked first, so the audit's before is the row the update replaces. Only changed fields are written to the audit
// entry, under their column names, with PII_COLUMNS redacted. An unchanged patch writes nothing.
export async function updateSettings(
  tx: Tx,
  patch: SettingsPatch,
  expectedVersion: number,
  actorUserId: string,
): Promise<WorkspaceSettings> {
  const current = await getSettings(tx, { forUpdate: true });
  if (current.version !== expectedVersion) throw new StaleSettingsError();
  const changed = (Object.keys(patch) as (keyof SettingsPatch)[]).filter(
    (key) => patch[key] !== undefined && patch[key] !== current[key],
  );
  if (changed.length === 0) return current;

  const [updated] = await tx
    .update(workspaceSettings)
    .set({ ...patch, version: sql`${workspaceSettings.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(workspaceSettings.workspaceId, current.workspaceId), eq(workspaceSettings.version, expectedVersion)))
    .returning();
  if (!updated) throw new StaleSettingsError();

  const snapshot = (row: WorkspaceSettings) =>
    Object.fromEntries([...changed, "version" as const].map((key) => [COLUMNS[key].name, row[key]]));
  await recordAudit(tx, {
    actorUserId,
    action: "workspace_settings.updated",
    targetType: "workspace_settings",
    targetId: current.workspaceId,
    before: snapshot(current),
    after: snapshot(updated),
    piiFields: PII_COLUMNS,
  });
  return updated;
}
