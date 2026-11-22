import { STEP_UP_EXPIRED, STEP_UP_NEEDED } from "@/lib/auth/messages";
import type { SaveResult } from "./bank-details-form";

// What a payment form does once its save returns. Saved: the page is rendered again with the stored values. Refused
// for step-up: the page is rendered again too, so the step-up prompt comes back when the window ran out while the
// page was open (it showed "Confirmed"), and focus then goes to its code field.
export type FollowUp = "none" | "refresh" | "prompt";

export function saveFollowUp(result: SaveResult | null): FollowUp {
  if (result?.ok) return "refresh";
  if (result?.status === "STEP_UP_REQUIRED") return "prompt";
  return "none";
}

// The page said "Confirmed" when the save was sent: the window ran out since; otherwise no step-up was done yet.
export function stepUpRefusal(confirmedAtSubmit: boolean): string {
  return confirmedAtSubmit ? STEP_UP_EXPIRED : STEP_UP_NEEDED;
}
