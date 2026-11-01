"use client";

import { redirect } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/auth/action";
import {
  SEND_TEST_EMAIL,
  SENDING_TEST_EMAIL,
  TEST_EMAIL_FAILED,
  TEST_EMAIL_FORBIDDEN,
  TEST_EMAIL_QUEUED,
  TEST_EMAIL_RATE_LIMITED,
} from "@/lib/auth/messages";

type SendResult = ActionResult<{ queued: boolean }>;

interface FormProps {
  // sendTestEmail with its input and idempotency key bound by the page.
  action: () => Promise<SendResult>;
}

// Every refusal but Staff's and the limit's is one the user can only retry (a stale workspace, a reused key, a
// malformed post).
function errorFor(result: SendResult): string | null {
  if (result.ok) return null;
  if (result.status === "FORBIDDEN") return TEST_EMAIL_FORBIDDEN;
  return result.status === "RATE_LIMITED" ? TEST_EMAIL_RATE_LIMITED : TEST_EMAIL_FAILED;
}

function SendTestEmailButton({ action, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SendResult | null>(action, null);
  const button = useRef<HTMLButtonElement>(null);

  // Disabling the button while pending drops its focus; put it back once there is an answer (A11Y-01). After an
  // unreachable server the form is mounted again, told so.
  useEffect(() => {
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result ? errorFor(result) : unreachable ? TEST_EMAIL_FAILED : null;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button
        ref={button}
        type="submit"
        disabled={pending}
        aria-describedby={error ? "send-test-email-error" : undefined}
        className="self-start"
      >
        {pending ? SENDING_TEST_EMAIL : SEND_TEST_EMAIL}
      </Button>
      {error && (
        <p id="send-test-email-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {TEST_EMAIL_QUEUED}
        </p>
      )}
    </form>
  );
}

export function SendTestEmailForm({ action }: FormProps) {
  return (
    <SubmitFailureBoundary>
      {(unreachable) => <SendTestEmailButton action={action} unreachable={unreachable} />}
    </SubmitFailureBoundary>
  );
}
