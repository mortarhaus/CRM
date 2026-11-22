"use client";

import { redirect, useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/auth/action";
import {
  STEP_UP_CONFIRMING,
  STEP_UP_FAILED,
  STEP_UP_HEADING,
  STEP_UP_HINT,
  STEP_UP_LABEL,
  STEP_UP_RATE_LIMITED,
  STEP_UP_SUBMIT,
  WRONG_CODE,
} from "@/lib/auth/messages";

type StepUpResult = ActionResult<{ verified: boolean }>;

interface PromptProps {
  // verifyStepUp, called as (previous state, form data) by the page's actions file.
  action: (previous: StepUpResult | null, form: FormData) => Promise<StepUpResult>;
}

const INPUT_ID = "step-up-code";
const ERROR_ID = "step-up-error";
const HINT_ID = "step-up-hint";

const MESSAGES: Partial<Record<Exclude<StepUpResult, { ok: true }>["status"], string>> = {
  INVALID_INPUT: WRONG_CODE,
  WRONG_CODE,
  RATE_LIMITED: STEP_UP_RATE_LIMITED,
};

// The step-up prompt (AUTH-09; spec "Authorization"): a fresh TOTP code unlocks the page's high-risk actions for the
// step-up window. Done, the page is rendered again (it then shows that the session is confirmed); without JavaScript
// the post renders the page again anyway. A refused code keeps focus in the field (A11Y-01).
function PromptFields({ action, unreachable }: PromptProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<StepUpResult | null, FormData>(action, null);
  const router = useRouter();

  useEffect(() => {
    if (result?.ok) router.refresh();
    // The vendored Input takes no ref; the id is this component's own.
    else if (result !== null || unreachable) document.getElementById(INPUT_ID)?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result?.ok === false ? (MESSAGES[result.status] ?? STEP_UP_FAILED) : unreachable ? STEP_UP_FAILED : null;

  return (
    <section aria-labelledby="step-up-heading" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <h2 id="step-up-heading" className="text-lg font-semibold">
        {STEP_UP_HEADING}
      </h2>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor={INPUT_ID}>{STEP_UP_LABEL}</Label>
          <p id={HINT_ID} className="text-sm text-muted-foreground">
            {STEP_UP_HINT}
          </p>
          <Input
            id={INPUT_ID}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
          />
        </div>
        {error && (
          <p id={ERROR_ID} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? STEP_UP_CONFIRMING : STEP_UP_SUBMIT}
        </Button>
      </form>
    </section>
  );
}

export function StepUpPrompt(props: PromptProps) {
  return <SubmitFailureBoundary>{(unreachable) => <PromptFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}
