import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MinimalShell } from "@/components/shell/minimal-shell";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { SignOutButton } from "../(app)/sign-out-button";
import { WorkspaceSwitcher } from "../(app)/workspace-switcher";

// Outside the app layout, which sends an Owner here while the workspace has no country (plan Task 8): the full shell's
// navigation and settings are not shown until onboarding is done.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const workspaces = await listWorkspaces();
  const activeId = session.session.activeOrganizationId ?? null;
  return (
    <MinimalShell
      workspaceSwitcher={<WorkspaceSwitcher workspaces={workspaces.map(({ id, name }) => ({ id, name }))} activeId={activeId} />}
      signOut={<SignOutButton />}
    >
      {children}
    </MinimalShell>
  );
}
