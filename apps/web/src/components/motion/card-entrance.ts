import { cn } from "@/lib/utils";

// Staggered card entrance (plan Task 3): a class per position from a fixed scale, never an inline style (CSP
// style-src has no 'unsafe-inline'). With reduced motion the animation class does not apply at all.
const ENTER_DELAYS = ["enter-delay-0", "enter-delay-1", "enter-delay-2", "enter-delay-3", "enter-delay-4", "enter-delay-5"];

export function cardEntrance(index: number): string {
  return cn("motion-safe:animate-card-enter", ENTER_DELAYS[Math.min(index, ENTER_DELAYS.length - 1)]);
}
