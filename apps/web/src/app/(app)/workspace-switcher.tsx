"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WORKSPACE_SWITCH_FAILED } from "@/lib/auth/messages";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { setActiveWorkspaceAction } from "./actions";

interface WorkspaceOption {
  id: string;
  name: string;
}

interface SwitcherProps {
  workspaces: WorkspaceOption[];
  activeId: string | null;
}

function WorkspaceSwitcherForm({ workspaces, activeId, unreachable }: SwitcherProps & { unreachable: boolean }) {
  const [state, formAction] = useActionState(setActiveWorkspaceAction, EMPTY_FORM_STATE);
  const select = useRef<HTMLSelectElement>(null);
  const [selected, setSelected] = useState(activeId ?? "");
  const [serverActiveId, setServerActiveId] = useState(activeId);
  const [answered, setAnswered] = useState(state);
  const [showUnreachable, setShowUnreachable] = useState(unreachable);

  // Follow the server's active workspace after a refresh without remounting or disabling the
  // select, either of which would drop keyboard focus.
  if (activeId !== serverActiveId) {
    setServerActiveId(activeId);
    setSelected(activeId ?? "");
  }
  // A refused switch puts the select back on the workspace the server still has active.
  if (state !== answered) {
    setAnswered(state);
    setShowUnreachable(false);
    if (state.error) setSelected(activeId ?? "");
  }

  // After an unreachable server the form is mounted again; put focus back on the select (A11Y-01).
  useEffect(() => {
    if (unreachable) select.current?.focus();
  }, [unreachable]);

  const error = state.error ?? (showUnreachable ? WORKSPACE_SWITCH_FAILED : null);

  // With JavaScript a change submits at once; focus stays on the select, which is never disabled.
  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelected(event.target.value);
    event.target.form?.requestSubmit();
  }

  // React resets a form after its action, which would put the select back on the option it first
  // rendered; dispatching the action here skips that reset. Without JavaScript the form posts as usual.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex min-w-0 flex-wrap items-center gap-2">
      <Label htmlFor="workspace-switcher">Active workspace</Label>
      <select
        ref={select}
        id="workspace-switcher"
        name="organizationId"
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
      {/* The submit path without JavaScript; with it, a change already submits. */}
      <Button type="submit" variant="outline">
        Switch
      </Button>
      {error && (
        <p id="workspace-switcher-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

export function WorkspaceSwitcher({ workspaces, activeId }: SwitcherProps) {
  if (workspaces.length === 0) return null;
  return (
    <SubmitFailureBoundary>
      {(unreachable) => <WorkspaceSwitcherForm workspaces={workspaces} activeId={activeId} unreachable={unreachable} />}
    </SubmitFailureBoundary>
  );
}
