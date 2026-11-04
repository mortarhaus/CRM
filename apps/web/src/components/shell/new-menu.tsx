"use client";

import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

// Lists only what can be created today (plan Q7, UNI-05). A native disclosure, so it opens without JavaScript.
export function NewMenu() {
  // The shell stays mounted across client navigations, so the disclosure is closed by hand once a link is chosen.
  function close(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <details className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
        <Plus aria-hidden className="size-4" />
        New
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="absolute right-0 z-20 mt-2 min-w-44 rounded-xl border border-border bg-card p-1 shadow-lg">
        <li>
          <Link
            href="/workspaces#create-workspace-heading"
            onClick={close}
            className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Workspace
          </Link>
        </li>
      </ul>
    </details>
  );
}
