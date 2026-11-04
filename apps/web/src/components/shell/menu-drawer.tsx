"use client";

import { Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const DRAWER_ID = "shell-menu";
// Tailwind's md breakpoint: from here the rail and the top bar show everything the drawer holds.
const WIDE = "(min-width: 48rem)";

const ICON_BUTTON =
  "flex size-10 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Below md the full menu is a modal <dialog> sliding in from the left (the Kinlo sample's phone layout). The buttons
// open and close it with HTML invoker commands, so it works without JavaScript (FE-32); a modal dialog makes the page
// behind it inert, closes on Esc and gives focus back to the menu button natively. The script below only adds what
// HTML cannot: aria-expanded, a fallback for browsers without invoker commands, and closing when a link is chosen
// (the shell stays mounted across client navigations) or the window grows past md.
export function MenuDrawer({ children }: { children: ReactNode }) {
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const trigger = button.current;
    const drawer = dialog.current;
    if (!trigger || !drawer) return;
    const sync = () => trigger.setAttribute("aria-expanded", String(drawer.open));
    const closeOnLinkOrBackdrop = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // closedby="any" handles a backdrop click where the browser supports it; the dialog itself is the target there.
      const onBackdrop = target === drawer && !("closedBy" in HTMLDialogElement.prototype);
      if (onBackdrop || target.closest("a[href]")) drawer.close();
    };
    const wide = window.matchMedia(WIDE);
    const closeWhenWide = () => {
      if (wide.matches) drawer.close();
    };
    sync();
    drawer.addEventListener("toggle", sync);
    drawer.addEventListener("close", sync);
    drawer.addEventListener("click", closeOnLinkOrBackdrop);
    wide.addEventListener("change", closeWhenWide);
    return () => {
      drawer.removeEventListener("toggle", sync);
      drawer.removeEventListener("close", sync);
      drawer.removeEventListener("click", closeOnLinkOrBackdrop);
      wide.removeEventListener("change", closeWhenWide);
    };
  }, []);

  const supportsCommands = () => "command" in HTMLButtonElement.prototype;

  function open() {
    if (supportsCommands() || !dialog.current) return;
    dialog.current.showModal();
    button.current?.setAttribute("aria-expanded", "true");
  }

  function close() {
    if (!supportsCommands()) dialog.current?.close();
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        command="show-modal"
        commandfor={DRAWER_ID}
        aria-controls={DRAWER_ID}
        aria-haspopup="dialog"
        aria-label="Open menu"
        onClick={open}
        className={cn(ICON_BUTTON, "md:hidden")}
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <dialog
        ref={dialog}
        id={DRAWER_ID}
        aria-label="Menu"
        closedby="any"
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-dvh w-75 max-w-[calc(100vw-2.5rem)] -translate-x-full overflow-y-auto rounded-r-2xl border-r border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-background/70 backdrop:backdrop-blur-sm open:translate-x-0 motion-safe:transition-[translate,display,overlay] motion-safe:transition-discrete motion-safe:duration-200 motion-safe:ease-out starting:open:-translate-x-full"
      >
        <div className="flex min-h-full flex-col gap-6 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">CRM</p>
            <button
              type="button"
              command="close"
              commandfor={DRAWER_ID}
              aria-label="Close menu"
              onClick={close}
              className={ICON_BUTTON}
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
