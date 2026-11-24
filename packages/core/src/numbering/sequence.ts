import { NEVER_PERIOD, periodKey } from "./format";
import type { ResetRule } from "./pattern";

// A doc_sequence row as the rules read it.
export interface SequenceState {
  resetRule: ResetRule;
  // The last number given in lastResetPeriod (0 before the first).
  counter: number;
  // The period of the last number, or null before the first.
  lastResetPeriod: string | null;
}

// The instant falls in a period earlier than the one of the last number given: in the workspace time zone it is still
// before that period began (a time zone changed to one further west, a clock behind another, a time taken before
// another issue). Starting the counter again there would repeat numbers already given in that earlier period, so the
// caller gets this instead and gives no number (Bob PR #72 R1 P1). It clears once the stored period begins.
export class PeriodBehindError extends Error {
  constructor(
    readonly period: string,
    readonly lastResetPeriod: string,
  ) {
    super(`the period ${period} is earlier than the period of the last number, ${lastResetPeriod}`);
    this.name = "PeriodBehindError";
  }
}

// Refuses a period earlier than the stored one. Both are periodKey values of one rule ("YYYY", "YYYY-MM" or the never
// constant: fixed-width digits, so they compare as strings); any other pairing is a row no code path writes.
function refuseBackwards(period: string, lastResetPeriod: string | null): void {
  if (lastResetPeriod === null) return;
  if (period.length !== lastResetPeriod.length || (period === NEVER_PERIOD) !== (lastResetPeriod === NEVER_PERIOD)) {
    throw new Error(`doc_sequence period ${lastResetPeriod} does not fit the reset rule (expected the shape of ${period})`);
  }
  if (period < lastResetPeriod) throw new PeriodBehindError(period, lastResetPeriod);
}

// The next counter value and its period. The allocator stores both; the preview only shows the value. One function,
// so the preview cannot drift from the allocator. The counter continues inside the stored period, starts again at 1
// in a later one, and an earlier one is refused with PeriodBehindError (never a reset backwards).
export function nextSequence(state: SequenceState, at: Date, timeZone: string): { seq: number; period: string } {
  const period = periodKey(state.resetRule, at, timeZone);
  refuseBackwards(period, state.lastResetPeriod);
  const base = state.lastResetPeriod === period ? state.counter : 0;
  return { seq: base + 1, period };
}

// The state after the reset rule changes at `at`: a reset already due under the old rule happens, then the counter
// continues and the stored period becomes the new rule's current one. So a change never restarts the counter inside
// the current period (which would repeat numbers already given in it); the first reset under the new rule is at its
// next period boundary. The same rule returns the state as it is. An `at` in a period earlier than the stored one is
// refused with PeriodBehindError, as nextSequence refuses it.
export function withResetRule(state: SequenceState, resetRule: ResetRule, at: Date, timeZone: string): SequenceState {
  if (resetRule === state.resetRule) return state;
  const current = periodKey(state.resetRule, at, timeZone);
  refuseBackwards(current, state.lastResetPeriod);
  const counter = state.lastResetPeriod === current ? state.counter : 0;
  return { resetRule, counter, lastResetPeriod: counter === 0 ? null : periodKey(resetRule, at, timeZone) };
}
