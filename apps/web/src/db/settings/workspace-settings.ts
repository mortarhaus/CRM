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
  "bank_account_holder",
] as const;

// The bank account number is audited as its last 4 characters as saved, never hashed, so a value of 4 characters or
// fewer is recorded whole (spec "Authorization", revision 13; DECISIONS 2026-11-27). Characters are code points, as
// the input counts them: slicing UTF-16 units could split a pair, which jsonb refuses (Bob spec R32 P2).
const AUDIT_MASKS: Partial<Record<string, (value: unknown) => unknown>> = {
  bank_account_number: (value) => (typeof value === "string" ? { last4: Array.from(value).slice(-4).join("") } : value),
};
const audited = (column: string, value: unknown) => AUDIT_MASKS[column]?.(value) ?? value;

const COLUMNS = getTableColumns(workspaceSettings);

// The audit action of a bank-details or payment QR change; the owner email job reads the entry by its id.
export const BANK_DETAILS_AUDIT_ACTION = "workspace_settings.bank_details_updated";

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

// Whether the workspace requires 2FA of its Admins and Owners (spec "Authentication and sessions"; ASK 9). False when
// the row is still to be healed (the column's default).
export async function requiresTwoFactor(tx: Tx): Promise<boolean> {
  const [row] = await tx
    .select({ require2fa: workspaceSettings.require2fa })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId()));
  return row?.require2fa ?? false;
}

// What the app layout reads on every page: the colour it renders, and whether the workspace has been through
// onboarding (a country is set). Both null when the row is still to be healed (the layout must not fail where
// getSettings would throw); a missing row counts as not onboarded.
export async function findShellSettings(tx: Tx): Promise<{ brandColour: string | null; country: string | null }> {
  const [row] = await tx
    .select({ brandColour: workspaceSettings.brandColour, country: workspaceSettings.country })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId()));
  return row ?? { brandColour: null, country: null };
}

// Optimistic concurrency: the patch applies only to the version the caller read, which becomes version + 1. The row
// is locked first, so the audit's before is the row the update replaces. Only changed fields are written to the audit
// entry, under their column names, with AUDIT_MASKS applied and PII_COLUMNS redacted, under auditId when given. An
// unchanged patch writes nothing.
export async function updateSettings(
  tx: Tx,
  patch: SettingsPatch,
  expectedVersion: number,
  actorUserId: string,
  auditAction:
    | "workspace_settings.updated"
    | "workspace_settings.onboarded"
    | typeof BANK_DETAILS_AUDIT_ACTION = "workspace_settings.updated",
  auditId?: string,
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
    Object.fromEntries([...changed, "version" as const].map((key) => [COLUMNS[key].name, audited(COLUMNS[key].name, row[key])]));
  await recordAudit(tx, {
    ...(auditId ? { id: auditId } : {}),
    actorUserId,
    action: auditAction,
    targetType: "workspace_settings",
    targetId: current.workspaceId,
    before: snapshot(current),
    after: snapshot(updated),
    piiFields: PII_COLUMNS,
  });
  return updated;
}
