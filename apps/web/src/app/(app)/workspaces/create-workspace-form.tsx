"use client";

import { WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { toWorkspaceSlug } from "@crm/core/workspace";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const name = String(new FormData(formElement).get("name") ?? "").trim();
    if (!name) {
      setError("Enter a workspace name.");
      return;
    }
    setPending(true);
    setError(null);
    const { error: createError } = await authClient.organization.create({
      name,
      slug: toWorkspaceSlug(name, crypto.randomUUID().slice(0, 8)),
    });
    setPending(false);
    if (createError) {
      setError("We couldn't create that workspace. Try again.");
      return;
    }
    formElement.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          name="name"
          type="text"
          autoComplete="organization"
          required
          maxLength={WORKSPACE_NAME_MAX_LENGTH}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "create-workspace-error" : undefined}
        />
      </div>
      {error && (
        <p id="create-workspace-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Create workspace
      </Button>
    </form>
  );
}
