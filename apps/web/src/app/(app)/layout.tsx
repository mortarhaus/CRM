import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode, ViewTransition } from "react";
import { BottomBar } from "@/components/shell/bottom-bar";
import { PageHeader } from "@/components/shell/page-header";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { findBrandColour } from "@/db/settings/workspace-settings";
import { findMembership } from "@/db/system";
import { withWorkspace } from "@/db/workspace";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { brandTokenCss } from "@/lib/brand";
import { currentTheme } from "@/lib/theme";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

// The active workspace's colour, read only for a member of it.
async function brandColourFor(userId: string, workspaceId: string | null) {
  const membership = workspaceId ? await findMembership(userId, workspaceId) : null;
  const brandColour = membership && workspaceId ? await withWorkspace(workspaceId, findBrandColour) : null;
  return { membership, brandColour };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const activeId = session.session.activeOrganizationId ?? null;
  // The role is read for the nav only (the Email and Branding links); each page and action checks it again (AUTH-02).
  const [workspaces, { membership, brandColour }, theme, requestHeaders] = await Promise.all([
    listWorkspaces(),
    brandColourFor(session.user.id, activeId),
    currentTheme(),
    headers(),
  ]);
  const showAdminSettings = membership?.role === "admin" || membership?.role === "owner";
  // The page CSP allows an inline <style> only with this request's nonce (src/proxy.ts).
  const nonce = requestHeaders.get("x-nonce");
  const brandCss = brandTokenCss(brandColour);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {brandCss && nonce && <style nonce={nonce}>{brandCss}</style>}
      <Sidebar showAdminSettings={showAdminSettings} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          theme={theme}
          user={{ name: session.user.name, email: session.user.email }}
          showAdminSettings={showAdminSettings}
          workspaceSwitcher={
            <WorkspaceSwitcher workspaces={workspaces.map(({ id, name }) => ({ id, name }))} activeId={activeId} />
          }
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
