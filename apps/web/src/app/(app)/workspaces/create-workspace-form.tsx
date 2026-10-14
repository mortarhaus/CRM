"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { createWorkspaceAction } from "./actions";

export function CreateWorkspaceForm() {
  const [state, formAction, pending] = useActionState(createWorkspaceAction, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          name="name"
          type="text"
          autoComplete="organization"
          required
          defaultValue={state.fields.name}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "create-workspace-error" : undefined}
        />
      </div>
      {state.error && (
        <p id="create-workspace-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Create workspace
      </Button>
    </form>
  );
}
