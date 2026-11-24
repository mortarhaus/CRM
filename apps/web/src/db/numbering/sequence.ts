import { isResetRule, type ResetRule, withResetRule } from "@crm/core/numbering";
import { COUNTRY_DEFAULTS, type Country } from "@crm/core/settings";
import { and, eq, sql } from "drizzle-orm";
import { recordAudit } from "../../lib/audit";
import { docSequence } from "../schema";
import { type Clock, databaseClock } from "./clock";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../workspace";

// The document types with a counter. Only the invoice in Phase 2 (plan Q20); a later phase adds its type here and to
// the doc_type CHECK (migration 0033) when it first issues that document.
export const DOC_TYPES = ["invoice"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export type DocSequence = typeof docSequence.$inferSelect;

export class StaleSequenceError extends Error {
  constructor() {
    super("doc_sequence changed since it was read");
    this.name = "StaleSequenceError";
  }
}

export class NoSequenceError extends Error {
  constructor(readonly docType: DocType) {
    super(`no doc_sequence row for ${docType}`);
    this.name = "NoSequenceError";
  }
}

function workspaceId(): string {
  const id = currentWorkspaceId();
  if (id === undefined) throw new NoWorkspaceError();
  return id;
}

// The stored reset rule, checked (the column's CHECK holds the same list).
export function resetRuleOf(row: DocSequence): ResetRule {
  if (!isResetRule(row.resetRule)) throw new Error(`doc_sequence holds an unknown reset rule: ${row.resetRule}`);
  return row.resetRule;
}

// The transaction's row for a document type, or null. forUpdate takes the row lock the allocator takes, and only it:
// one row of one workspace, held until the transaction ends.
export async function findSequence(tx: Tx, docType: DocType, options: { forUpdate?: boolean } = {}): Promise<DocSequence | null> {
  const query = tx
    .select()
    .from(docSequence)
    .where(and(eq(docSequence.workspaceId, workspaceId()), eq(docSequence.docType, docType)));
  const [row] = options.forUpdate ? await query.for("update") : await query;
  return row ?? null;
}

const audited = (row: DocSequence) => ({ pattern: row.pattern, reset_rule: row.resetRule, version: row.version });

// The invoice counter with the country's default pattern and reset rule (Charlie 2026-11-23: yearly), created once:
// at onboarding (applyCountryDefaults), or for a workspace onboarded before this table existed, when its numbering is
// first opened or saved. An existing row is never changed. Audited when it is created. Null when the country has no
// default pattern (none today).
export async function ensureInvoiceSequence(tx: Tx, country: Country, actorUserId: string): Promise<DocSequence | null> {
  const { invoicePattern, invoiceResetRule } = COUNTRY_DEFAULTS[country];
  if (invoicePattern === null) return findSequence(tx, "invoice");
  const [created] = await tx
    .insert(docSequence)
    .values({ workspaceId: workspaceId(), docType: "invoice", pattern: invoicePattern, resetRule: invoiceResetRule })
    .onConflictDoNothing()
    .returning();
  if (!created) return findSequence(tx, "invoice");
  await recordAudit(tx, {
    actorUserId,
    action: "doc_sequence.created",
    targetType: "doc_sequence",
    targetId: null,
    after: { doc_type: created.docType, ...audited(created) },
  });
  return created;
}

// A settings change (Admin or Owner, plan Q20): the pattern and the reset rule, to the version the caller read. It
// takes the allocator's row lock, so it waits for an issue in flight and the next number uses the new pattern (a
// change applies to new documents only; no number already given is touched, REC-09). A reset-rule change keeps the
// counter inside the current period (withResetRule), at the database clock's time read after the lock; a rule change
// at a time in a period earlier than the stored one (the workspace time zone moved west across a boundary) throws
// PeriodBehindError and writes nothing. Audited with the before and after pattern and rule; an unchanged save writes
// nothing. The caller has checked the pattern (parsePatternFor). `clock` is for tests only.
export async function updateSequence(
  tx: Tx,
  docType: DocType,
  change: { pattern: string; resetRule: ResetRule },
  expectedVersion: number,
  actorUserId: string,
  timeZone: string,
  options: { clock?: Clock } = {},
): Promise<DocSequence> {
  const current = await findSequence(tx, docType, { forUpdate: true });
  if (!current) throw new NoSequenceError(docType);
  if (current.version !== expectedVersion) throw new StaleSequenceError();
  if (current.pattern === change.pattern && current.resetRule === change.resetRule) return current;
  const at = await (options.clock ?? databaseClock)(tx);

  const state = withResetRule(
    { resetRule: resetRuleOf(current), counter: current.counter, lastResetPeriod: current.lastResetPeriod },
    change.resetRule,
    at,
    timeZone,
  );
  const [updated] = await tx
    .update(docSequence)
    .set({
      pattern: change.pattern,
      resetRule: state.resetRule,
      counter: state.counter,
      lastResetPeriod: state.lastResetPeriod,
      version: sql`${docSequence.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(docSequence.workspaceId, current.workspaceId), eq(docSequence.docType, docType)))
    .returning();
  if (!updated) throw new StaleSequenceError();
  await recordAudit(tx, {
    actorUserId,
    action: "doc_sequence.updated",
    targetType: "doc_sequence",
    targetId: null,
    before: { doc_type: docType, ...audited(current) },
    after: { doc_type: docType, ...audited(updated) },
  });
  return updated;
}
