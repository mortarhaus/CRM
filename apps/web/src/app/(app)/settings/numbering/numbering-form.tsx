"use client";

import {
  formatNumber,
  isResetRule,
  MissingCodeError,
  nextSequence,
  parsePatternFor,
  RESET_RULES,
  type ResetRule,
  withResetRule,
} from "@crm/core/numbering";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/lib/auth/action";
import {
  NEW_DOCUMENTS_ONLY,
  NUMBERING_FAILED,
  NUMBERING_FORBIDDEN,
  NUMBERING_INVALID,
  NUMBERING_NO_CODE,
  NUMBERING_NO_PREVIEW,
  NUMBERING_PATTERN,
  NUMBERING_PATTERN_HINT,
  NUMBERING_PREVIEW,
  NUMBERING_RESET,
  NUMBERING_RESET_HINT,
  NUMBERING_SAVE,
  NUMBERING_SAVED,
  NUMBERING_SAVING,
  NUMBERING_STALE,
  patternErrorMessage,
  RESET_RULE_LABELS,
  SETUP_PENDING,
} from "@/lib/auth/messages";

type SaveResult = ActionResult<{ version: number }>;

export interface NumberingValues {
  version: number;
  pattern: string;
  resetRule: ResetRule;
  counter: number;
  lastResetPeriod: string | null;
  shortCode: string | null;
  timeZone: string;
  // ISO instant the preview is computed for (the page's render time).
  at: string;
}

interface FormProps {
  // updateNumberingSettings: called as (previous state, form data), it reads the form (action() fromForm).
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  values: NumberingValues;
}

const REFUSALS: Partial<Record<string, string>> = {
  INVALID_INPUT: NUMBERING_INVALID,
  STALE_VERSION: NUMBERING_STALE,
  FORBIDDEN: NUMBERING_FORBIDDEN,
  NOT_ONBOARDED: SETUP_PENDING,
};

type Preview = { ok: true; number: string } | { ok: false; reason: "pattern" | "code"; message: string };

// The next number for what is typed, by the same core functions the allocator runs (parsePatternFor, withResetRule,
// nextSequence, formatNumber): the counter the save would leave, for the instant the page was rendered.
function previewOf(pattern: string, resetRule: ResetRule, values: NumberingValues): Preview {
  const parsed = parsePatternFor(pattern.trim(), resetRule);
  if (!parsed.ok) return { ok: false, reason: "pattern", message: patternErrorMessage(parsed.error) };
  const at = new Date(values.at);
  const stored = { resetRule: values.resetRule, counter: values.counter, lastResetPeriod: values.lastResetPeriod };
  const { seq } = nextSequence(withResetRule(stored, resetRule, at, values.timeZone), at, values.timeZone);
  try {
    return { ok: true, number: formatNumber(parsed.pattern, { code: values.shortCode, seq, at, timeZone: values.timeZone }) };
  } catch (error) {
    if (error instanceof MissingCodeError) return { ok: false, reason: "code", message: NUMBERING_NO_CODE };
    throw error;
  }
}

function NumberingFields({ action, values, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  // Without JavaScript a refused form is rendered from what the action echoed.
  const echoed = result?.ok === false && result.status === "INVALID_INPUT" ? (result.echo ?? {}) : {};
  const [pattern, setPattern] = useState(echoed.pattern ?? values.pattern);
  const [resetRule, setResetRule] = useState<ResetRule>(
    echoed.resetRule && isResetRule(echoed.resetRule) ? echoed.resetRule : values.resetRule,
  );

  // A save is rendered again from the stored row (the version moves on). Focus goes back to the button, which was
  // disabled while the post was in flight (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result?.ok === false ? (REFUSALS[result.status] ?? NUMBERING_FAILED) : unreachable ? NUMBERING_FAILED : null;
  const version = result?.ok ? Math.max(result.data.version, values.version) : values.version;
  const preview = previewOf(pattern, resetRule, values);
  const patternInvalid = !preview.ok && preview.reason === "pattern";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="expectedVersion" value={version} />
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="number-pattern">{NUMBERING_PATTERN}</Label>
        <p id="number-pattern-hint" className="text-sm text-muted-foreground">
          {NUMBERING_PATTERN_HINT}
        </p>
        <Input
          id="number-pattern"
          name="pattern"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          aria-invalid={patternInvalid ? true : undefined}
          aria-describedby="number-pattern-hint number-preview"
          className="font-mono"
        />
      </div>
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="reset-rule">{NUMBERING_RESET}</Label>
        <p id="reset-rule-hint" className="text-sm text-muted-foreground">
          {NUMBERING_RESET_HINT}
        </p>
        <Select
          id="reset-rule"
          name="resetRule"
          value={resetRule}
          onChange={(event) => isResetRule(event.target.value) && setResetRule(event.target.value)}
          aria-describedby="reset-rule-hint"
        >
          {RESET_RULES.map((rule) => (
            <option key={rule} value={rule}>
              {RESET_RULE_LABELS[rule]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{NUMBERING_PREVIEW}</p>
        {/* Announced as the pattern changes (polite: after the user stops typing). */}
        <p id="number-preview" aria-live="polite" aria-atomic="true" className="text-sm break-all">
          {preview.ok ? (
            <span className="font-mono text-base font-semibold">{preview.number}</span>
          ) : (
            <span className={preview.reason === "pattern" ? "text-destructive" : undefined}>
              {NUMBERING_NO_PREVIEW}: {preview.message}
            </span>
          )}
        </p>
        {!preview.ok && preview.reason === "code" && (
          <Link href="/settings/general" className="text-sm underline underline-offset-4">
            General settings
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{NEW_DOCUMENTS_ONLY}</p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {NUMBERING_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? NUMBERING_SAVING : NUMBERING_SAVE}
      </Button>
    </form>
  );
}

export function NumberingForm(props: FormProps) {
  return (
    <SubmitFailureBoundary>{(unreachable) => <NumberingFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>
  );
}
