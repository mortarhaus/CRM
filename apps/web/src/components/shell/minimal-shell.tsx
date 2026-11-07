import type { ReactNode } from "react";

interface MinimalShellProps {
  workspaceSwitcher: ReactNode;
  signOut: ReactNode;
  children: ReactNode;
}

// The shell of a workspace that has not finished onboarding (plan Task 8): the workspace switcher and sign-out only,
// with no navigation and no settings. Used by /onboarding and by the page Admin and Staff see meanwhile.
export function MinimalShell({ workspaceSwitcher, signOut, children }: MinimalShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-15 w-full max-w-3xl flex-wrap items-center gap-3 px-4 py-2.5">
          <p className="mr-auto text-lg font-semibold">CRM</p>
          {workspaceSwitcher}
          {signOut}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
