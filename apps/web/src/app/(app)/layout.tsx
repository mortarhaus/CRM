import { redirect } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { findMembership } from "@/db/system";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { currentTheme } from "@/lib/theme";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const activeId = session.session.activeOrganizationId ?? null;
  // The role is read for the nav only (the Email link); each page and action checks it again (AUTH-02).
  const [workspaces, membership, theme] = await Promise.all([
    listWorkspaces(),
    activeId ? findMembership(session.user.id, activeId) : null,
    currentTheme(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar showEmailSettings={membership?.role === "admin" || membership?.role === "owner"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar userName={session.user.name} theme={theme}>
          <WorkspaceSwitcher workspaces={workspaces.map(({ id, name }) => ({ id, name }))} activeId={activeId} />
          <SignOutButton />
        </TopBar>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8">
          {/* Client navigations cross-fade the page content (React 19.3; Next 16 needs no config). */}
          <ViewTransition>{children}</ViewTransition>
        </main>
      </div>
    </div>
  );
}
