"use client";

import { useSyncExternalStore } from "react";
import { OUTDATED_BROWSER } from "@/lib/auth/messages";

// What the app relies on and CSS cannot test (globals.css shows the notice for light-dark() and :has()): HTML invoker
// commands (the phone menu drawer without JavaScript) and <dialog>. Checked in the nonce'd bundle, never an inline
// script (UNI-09). With JavaScript off, a browser that has light-dark() and :has() but no invoker commands gets no
// notice (accepted, PR #53 R2).
export function lacksRequiredFeatures(): boolean {
  return typeof HTMLDialogElement !== "function" || !("command" in HTMLButtonElement.prototype);
}

const subscribeToNothing = () => () => {};

// A plain persistent note in the page flow, not role="alert" (which would interrupt on every page load). It is hidden
// unless a check fails; data-outdated is how the script's check reaches the CSS.
export function OutdatedBrowserNotice() {
  const outdated = useSyncExternalStore(subscribeToNothing, lacksRequiredFeatures, () => false);
  return (
    <aside aria-label="Browser support" data-outdated={outdated ? "" : undefined} className="outdated-browser-notice">
      <p>{OUTDATED_BROWSER}</p>
    </aside>
  );
}
