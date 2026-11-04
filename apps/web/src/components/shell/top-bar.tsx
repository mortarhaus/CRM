import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { NewMenu } from "./new-menu";
import { ThemeToggle } from "./theme-toggle";

interface TopBarProps {
  userName: string;
  theme: Theme;
  // The workspace switcher and sign-out live in the app route group; the bar only places them.
  children: ReactNode;
}

// No search box until search exists (plan Q7, UNI-05). The "what needs you" line has nothing to list until the
// document phases add work items.
export function TopBar({ userName, theme, children }: TopBarProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <p className="break-words text-lg font-semibold">Hello, {userName}</p>
          <p className="text-sm text-muted-foreground">Nothing needs you right now.</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <NewMenu />
          <ThemeToggle theme={theme} />
          {children}
        </div>
      </div>
    </header>
  );
}
