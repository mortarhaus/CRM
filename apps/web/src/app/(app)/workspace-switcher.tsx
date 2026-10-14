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
  const [pending, setPending] = useState(false);

  if (workspaces.length === 0) return null;

  async function onChange(event: ChangeEvent<HTMLSelectElement>) {
    setPending(true);
    setError(null);
    const { error: switchError } = await authClient.organization.setActive({ organizationId: event.target.value });
    setPending(false);
    if (switchError) {
      setError("Couldn't switch workspace. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Label htmlFor="workspace-switcher">Active workspace</Label>
      <select
        key={activeId ?? "none"}
        id="workspace-switcher"
        defaultValue={activeId ?? ""}
        onChange={onChange}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "workspace-switcher-error" : undefined}
        className="min-h-10 max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
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
