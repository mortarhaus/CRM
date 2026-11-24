import { formatNumber, nextSequence, parsePattern } from "@crm/core/numbering";
import { and, eq, sql } from "drizzle-orm";
import { docSequence, workspaceSettings } from "../schema";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../workspace";
import { type Clock, databaseClock } from "./clock";
import { type DocSequence, type DocType, findSequence, NoSequenceError, resetRuleOf } from "./sequence";

export class NumberingNotReadyError extends Error {
  constructor(reason: string) {
    super(`numbering is not ready: ${reason}`);
    this.name = "NumberingNotReadyError";
  }
}

// What a number needs besides the counter: the short code ({CODE}) and the workspace time zone (period tokens,
// REC-08), read in the same transaction. No lock: the allocator's lock is the doc_sequence row only.
async function workspaceInputs(tx: Tx): Promise<{ code: string | null; timeZone: string }> {
  const id = currentWorkspaceId();
  if (id === undefined) throw new NoWorkspaceError();
  const [row] = await tx
    .select({ code: workspaceSettings.shortCode, timeZone: workspaceSettings.timezone })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, id));
  if (!row?.timeZone) throw new NumberingNotReadyError("the workspace has no time zone (not onboarded)");
  return { code: row.code, timeZone: row.timeZone };
}

// The number the row gives next at `at`, and the counter state that goes with it. The one path for the preview and
// the allocator: the same nextSequence and the same formatNumber (plan Risk 4). formatNumber throws MissingCodeError
// when the pattern uses {CODE} and the workspace has no short code.
async function nextNumber(tx: Tx, row: DocSequence, at: Date): Promise<{ number: string; seq: number; period: string }> {
  const parsed = parsePattern(row.pattern);
  if (!parsed.ok) throw new NumberingNotReadyError(`the stored pattern is refused (${parsed.error.code})`);
  const { code, timeZone } = await workspaceInputs(tx);
  const { seq, period } = nextSequence(
    { resetRule: resetRuleOf(row), counter: row.counter, lastResetPeriod: row.lastResetPeriod },
    at,
    timeZone,
  );
  return { number: formatNumber(parsed.pattern, { code, seq, at, timeZone }), seq, period };
}

// A number and the instant it was taken: the issuing document's issue date is that instant (Phase 4), so the date and
// the number's period tokens always agree.
export interface AllocatedNumber {
  number: string;
  issuedAt: Date;
}

// Takes the next number (spec "Numbering"; REC-06, REC-07). Called only inside the transaction that issues or sends
// the document (Phase 4 onward; in Phase 2 only by tests): the row lock (SELECT … FOR UPDATE on this one
// doc_sequence row) serialises concurrent issues of the same type in the same workspace and nothing else, and is held
// until that transaction ends. The counter moves in the same transaction, so a rollback gives the number back and
// leaves no gap. The time is read after the lock, from the database clock (one clock for every instance), and
// returned with the number. The counter starts again at 1 when that instant's period (workspace time zone) is later
// than the stored one; an earlier one is refused with PeriodBehindError and takes no number, never a repeat.
// `clock` is for tests only (a fixed instant); it is still read after the lock.
export async function allocateNumber(tx: Tx, docType: DocType, options: { clock?: Clock } = {}): Promise<AllocatedNumber> {
  const row = await findSequence(tx, docType, { forUpdate: true });
  if (!row) throw new NoSequenceError(docType);
  const issuedAt = await (options.clock ?? databaseClock)(tx);
  const next = await nextNumber(tx, row, issuedAt);
  const updated = await tx
    .update(docSequence)
    .set({ counter: next.seq, lastResetPeriod: next.period, updatedAt: sql`now()` })
    .where(and(eq(docSequence.workspaceId, row.workspaceId), eq(docSequence.docType, docType)))
    .returning({ counter: docSequence.counter });
  if (updated.length !== 1) throw new Error("doc_sequence row not updated");
  return { number: next.number, issuedAt };
}

// The number allocateNumber would give at `at` if nothing else issues first (counter + 1, or 1 in a new period).
// No lock and no write: a preview never takes or holds a number. An `at` before the stored period throws
// PeriodBehindError, as the allocator would.
export async function previewNumber(tx: Tx, docType: DocType, at: Date): Promise<string> {
  const row = await findSequence(tx, docType);
  if (!row) throw new NoSequenceError(docType);
  return (await nextNumber(tx, row, at)).number;
}
