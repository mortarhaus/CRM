"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

interface WorkspaceOption {
  id: string;
  name: string;
}

export function WorkspaceSwitcher({ workspaces, activeId }: { workspaces: WorkspaceOption[]; activeId: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(activeId ?? "");
  const [serverActiveId, setServerActiveId] = useState(activeId);

  // Follow the server's active workspace after a refresh without remounting or disabling the
  // select, either of which would drop keyboard focus.
  if (activeId !== serverActiveId) {
    setServerActiveId(activeId);
    setSelected(activeId ?? "");
  }

  if (workspaces.length === 0) return null;

  async function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const previous = selected;
    setSelected(event.target.value);
    setError(null);
    const { error: switchError } = await authClient.organization.setActive({ organizationId: event.target.value });
    if (switchError) {
      setSelected(previous);
      setError("Couldn't switch workspace. Try again.");
    }
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Label htmlFor="workspace-switcher">Active workspace</Label>
      <select
        id="workspace-switcher"
        value={selected}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "workspace-switcher-error" : undefined}
        className="min-h-10 max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {activeId === null && (
          <option value="" disabled>
            Choose a workspace
          </option>
        )}
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      {error && (
        <p id="workspace-switcher-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
