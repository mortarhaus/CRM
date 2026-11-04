import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cardEntrance } from "@/components/motion/card-entrance";
import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { CreateWorkspaceForm } from "./create-workspace-form";

export const metadata: Metadata = { title: "Workspaces · CRM" };

export default async function WorkspacesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  const workspaces = await listWorkspaces();
  const activeId = session.session.activeOrganizationId ?? null;

  return (
    <>
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <section aria-labelledby="your-workspaces-heading" className="flex flex-col gap-3">
        <h2 id="your-workspaces-heading" className="text-lg font-semibold">
          Your workspaces
        </h2>
        {workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">You have no workspaces yet.</p>
        ) : (
          <ul aria-labelledby="your-workspaces-heading" className="flex flex-col gap-2">
            {workspaces.map((workspace, index) => (
              <li
                key={workspace.id}
                className={cn("flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3", cardEntrance(index))}
              >
                <span className="min-w-0 break-words">{workspace.name}</span>
                {workspace.id === activeId && <span className="text-xs text-muted-foreground">(active)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="create-workspace-heading" className="flex max-w-md flex-col gap-3">
        <h2 id="create-workspace-heading" className="text-lg font-semibold">
          Create a workspace
        </h2>
        <CreateWorkspaceForm />
      </section>
    </>
  );
}
