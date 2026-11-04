import { redirect } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";
import { BottomBar } from "@/components/shell/bottom-bar";
import { PageHeader } from "@/components/shell/page-header";
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
  const showEmailSettings = membership?.role === "admin" || membership?.role === "owner";

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar showEmailSettings={showEmailSettings} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          theme={theme}
          user={{ name: session.user.name, email: session.user.email }}
          showEmailSettings={showEmailSettings}
          workspaceSwitcher={
            <WorkspaceSwitcher workspaces={workspaces.map(({ id, name }) => ({ id, name }))} activeId={activeId} />
          }
          signOut={<SignOutButton />}
        />
        {/* Fixed at the bottom of the screen, but before <main> in the tab order, like the rail from md up. */}
        <BottomBar showEmailSettings={showEmailSettings} />
        {/* Below md the bottom padding is taller than the fixed tab bar, so the bar never covers the page's end. */}
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-8 pb-24 md:pb-8">
          <PageHeader userName={session.user.name} />
          {/* Client navigations cross-fade the page content (React 19.3; Next 16 needs no config). */}
          <ViewTransition>{children}</ViewTransition>
        </main>
      </div>
    </div>
  );
}
