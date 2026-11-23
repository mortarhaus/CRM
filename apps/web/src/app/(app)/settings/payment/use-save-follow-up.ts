import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
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
