import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { STEP_UP_INPUT_ID } from "@/components/step-up-prompt";
import type { SaveResult } from "./bank-details-form";
import { saveFollowUp } from "./save-follow-up";

// After each save focus goes back to the submit button, which was disabled while the post was in flight (A11Y-01).
// A step-up refusal refreshes the page so the prompt is shown, then moves focus to its code field. The refresh keeps
// this form's state and what was typed in it (React keeps client components across router.refresh()).
export function useSaveFollowUp(result: SaveResult | null, unreachable: boolean) {
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const focusCode = useRef(false);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    const next = saveFollowUp(result);
    if (next !== "none") startRefresh(() => router.refresh());
    focusCode.current = next === "prompt";
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  useEffect(() => {
    if (refreshing || !focusCode.current) return;
    focusCode.current = false;
    (document.getElementById(STEP_UP_INPUT_ID) ?? button.current)?.focus();
  }, [refreshing]);

  return button;
}

// Whether the form should still show its step-up refusal: not once the page shows "Confirmed" again after it (a fresh
// code was entered since), so "Your confirmation expired" does not stay beside "Confirmed" until the next save (Bob
// PR 70 R2 P3). Compared on each render with the previous steppedUp, as React's "storing information from previous
// renders" pattern does, so no effect and no extra paint.
export function useStepUpRefusal(result: SaveResult | null, steppedUp: boolean): boolean {
  const [previous, setPrevious] = useState(steppedUp);
  const [dismissed, setDismissed] = useState<SaveResult | null>(null);
  if (steppedUp !== previous) {
    setPrevious(steppedUp);
    if (steppedUp) setDismissed(result);
  }
  return result?.ok === false && result.status === "STEP_UP_REQUIRED" && result !== dismissed;
}
