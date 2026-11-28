import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";
import { BottomBar } from "@/components/shell/bottom-bar";
import { MinimalShell } from "@/components/shell/minimal-shell";
import { PageHeader } from "@/components/shell/page-header";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { findShellSettings } from "@/db/settings/workspace-settings";
import { findMembership } from "@/db/system";
import { withWorkspace } from "@/db/workspace";
import { SETUP_PENDING, SETUP_PENDING_HINT } from "@/lib/auth/messages";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { brandTokenCss } from "@/lib/brand";
import { currentTheme } from "@/lib/theme";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

// The active workspace's colour and country, read only for a member of it.
async function shellSettingsFor(userId: string, workspaceId: string | null) {
  const membership = workspaceId ? await findMembership(userId, workspaceId) : null;
  const settings = membership && workspaceId ? await withWorkspace(workspaceId, findShellSettings) : null;
  return { membership, settings };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const activeId = session.session.activeOrganizationId ?? null;
  // The role is read for the nav only (the Email, Branding and Bank links); each page and action checks it again (AUTH-02).
  const [workspaces, { membership, settings }, theme, requestHeaders] = await Promise.all([
    listWorkspaces(),
    shellSettingsFor(session.user.id, activeId),
    currentTheme(),
    headers(),
  ]);
  const switcher = <WorkspaceSwitcher workspaces={workspaces.map(({ id, name }) => ({ id, name }))} activeId={activeId} />;
  // A workspace without a country has not been through onboarding (a new one, or one whose owner left before the end):
  // its Owner is sent there, and everyone else sees only that it is not ready (plan Task 8). The onboarding route is
  // outside this layout, so the redirect cannot loop.
  if (membership && !settings?.country) {
    if (membership.role === "owner") redirect("/onboarding");
    return (
      <MinimalShell workspaceSwitcher={switcher} signOut={<SignOutButton />}>
        <h1 className="text-2xl font-semibold">{SETUP_PENDING}</h1>
        <p className="text-sm text-muted-foreground">{SETUP_PENDING_HINT}</p>
      </MinimalShell>
    );
  }
  const showAdminSettings = membership?.role === "admin" || membership?.role === "owner";
  // The page CSP allows an inline <style> only with this request's nonce (src/proxy.ts).
  const nonce = requestHeaders.get("x-nonce");
  const brandCss = brandTokenCss(settings?.brandColour ?? null);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {brandCss && nonce && <style nonce={nonce}>{brandCss}</style>}
      <Sidebar showAdminSettings={showAdminSettings} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          theme={theme}
          user={{ name: session.user.name, email: session.user.email }}
          showAdminSettings={showAdminSettings}
          workspaceSwitcher={switcher}
          signOut={<SignOutButton />}
        />
        {/* Fixed at the bottom of the screen, but before <main> in the tab order, like the rail from md up. */}
        <BottomBar showAdminSettings={showAdminSettings} />
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
