"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { SIGN_OUT_FAILED } from "@/lib/auth/messages";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { signOutAction } from "./actions";

function SignOutForm({ unreachable }: { unreachable: boolean }) {
  const [state, formAction, pending] = useActionState(
    signOutAction,
    unreachable ? { ...EMPTY_FORM_STATE, error: SIGN_OUT_FAILED } : EMPTY_FORM_STATE,
  );
  const button = useRef<HTMLButtonElement>(null);
  // Rendered twice by the shell (top bar and phone menu drawer), so the error id is generated.
  const errorId = useId();

  // Disabling the button while pending dropped its focus; put it back so a keyboard user can retry.
  useEffect(() => {
    if (state.error) button.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        ref={button}
        type="submit"
        variant="outline"
        disabled={pending}
        aria-describedby={state.error ? errorId : undefined}
      >
        Sign out
      </Button>
      {state.error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function SignOutButton() {
  return <SubmitFailureBoundary>{(unreachable) => <SignOutForm unreachable={unreachable} />}</SubmitFailureBoundary>;
}
