import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { findMembership } from "@/db/system";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { NavLinks } from "./nav-links";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const activeId = session.session.activeOrganizationId ?? null;
  // The role is read for the nav only (the Email link); each page and action checks it again (AUTH-02).
  const [workspaces, membership] = await Promise.all([
    listWorkspaces(),
    activeId ? findMembership(session.user.id, activeId) : null,
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <NavLinks showEmailSettings={membership?.role === "admin" || membership?.role === "owner"} />
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <WorkspaceSwitcher
              workspaces={workspaces.map(({ id, name }) => ({ id, name }))}
              activeId={activeId}
            />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">{children}</main>
    </div>
  );
}
