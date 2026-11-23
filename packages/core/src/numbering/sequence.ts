import { periodKey } from "./format";
import type { ResetRule } from "./pattern";

// A doc_sequence row as the rules read it.
export interface SequenceState {
  resetRule: ResetRule;
  // The last number given in lastResetPeriod (0 before the first).
  counter: number;
  // The period of the last number, or null before the first.
  lastResetPeriod: string | null;
}

// The next counter value and its period. The allocator stores both; the preview only shows the value. One function,
// so the preview cannot drift from the allocator.
export function nextSequence(state: SequenceState, at: Date, timeZone: string): { seq: number; period: string } {
  const period = periodKey(state.resetRule, at, timeZone);
  const base = state.lastResetPeriod === period ? state.counter : 0;
  return { seq: base + 1, period };
}

// The state after the reset rule changes at `at`: a reset already due under the old rule happens, then the counter
// continues and the stored period becomes the new rule's current one. So a change never restarts the counter inside
// the current period (which would repeat numbers already given in it); the first reset under the new rule is at its
// next period boundary. The same rule returns the state as it is.
export function withResetRule(state: SequenceState, resetRule: ResetRule, at: Date, timeZone: string): SequenceState {
  if (resetRule === state.resetRule) return state;
  const current = periodKey(state.resetRule, at, timeZone);
  const counter = state.lastResetPeriod === current ? state.counter : 0;
  return { resetRule, counter, lastResetPeriod: counter === 0 ? null : periodKey(resetRule, at, timeZone) };
}
