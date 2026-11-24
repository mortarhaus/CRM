"use client";

import type { Country } from "@crm/core/settings";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from "react";
import { TextField } from "@/components/settings/settings-field";
import { TAX_FIELD_ERRORS, TaxFields } from "@/components/settings/tax-fields";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/auth/action";
import {
  COUNTRY_NAMES,
  GENERAL_SHORT_CODE,
  GENERAL_SHORT_CODE_INVALID,
  ONBOARDING_CHANGE_COUNTRY,
  ONBOARDING_FAILED,
  ONBOARDING_INVALID,
  ONBOARDING_OPTIONAL_IDS,
  ONBOARDING_SAVE,
  ONBOARDING_SAVING,
  ONBOARDING_SHORT_CODE_HINT,
  ONBOARDING_STALE,
  ONBOARDING_TAX_HINT,
  TAX_SCHEMES,
} from "@/lib/auth/messages";

type SaveResult = ActionResult<{ version: number }>;

const FIELD_ERRORS: Record<string, string> = { ...TAX_FIELD_ERRORS, shortCode: GENERAL_SHORT_CODE_INVALID };

interface FormProps {
  // completeOnboarding: called as (previous state, form data), it reads the form's fields (action() fromForm). Done,
  // it redirects instead of returning.
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  country: Country;
  // The country's tax name and rate (a percentage), preselected for a Yes and editable (spec line 732).
  taxName: string;
  taxRate: string;
  version: number;
}

function formError(result: SaveResult): string {
  if (result.ok) return "";
  if (result.status === "INVALID_INPUT") return ONBOARDING_INVALID;
  return result.status === "STALE_VERSION" ? ONBOARDING_STALE : ONBOARDING_FAILED;
}

function OnboardingFields({ action, country, taxName, taxRate, version, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const button = useRef<HTMLButtonElement>(null);
  const scheme = TAX_SCHEMES[country];

  // Done, the action redirects to the app, so a result here is a refusal: focus goes back to the button, which was
  // disabled while the post was in flight (A11Y-01).
  useEffect(() => {
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result && !result.ok ? formError(result) : unreachable ? ONBOARDING_FAILED : null;
  const refused = result?.ok === false && result.status === "INVALID_INPUT" ? result : null;
  const invalid = new Set(refused?.fields ?? []);
  // Without JavaScript the page is rendered from the result: the echoed short code, answer and tax values come back as
  // defaults. With JavaScript the form is not reset (onSubmit below), so the inputs keep what was typed either way.
  const echoed = refused?.echo ?? {};
  const yes = echoed.taxRegistered === "yes";
  const fieldError = (name: string) => (invalid.has(name) ? FIELD_ERRORS[name] : undefined);

  // React resets a form after its action, which would clear what the Owner typed when a field is refused; dispatching
  // the action here skips that reset. Without JavaScript the form posts as usual.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="group flex flex-col gap-8">
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="country" value={country} />
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{COUNTRY_NAMES[country]}</span>
        <Link href="/onboarding" className="text-sm underline underline-offset-4">
          {ONBOARDING_CHANGE_COUNTRY}
        </Link>
      </p>

      {/* Never pre-filled: empty skips it (Charlie 2026-11-24). */}
      <TextField
        id="short-code"
        name="shortCode"
        label={GENERAL_SHORT_CODE}
        hint={ONBOARDING_SHORT_CODE_HINT}
        defaultValue={echoed.shortCode}
        error={fieldError("shortCode")}
      />

      <TaxFields
        scheme={scheme}
        taxHint={ONBOARDING_TAX_HINT}
        idsHint={ONBOARDING_OPTIONAL_IDS}
        yes={yes}
        values={{ taxName: echoed.taxName ?? taxName, taxRate: echoed.taxRate ?? taxRate }}
        fieldError={fieldError}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? ONBOARDING_SAVING : ONBOARDING_SAVE}
      </Button>
    </form>
  );
}

export function OnboardingForm(props: FormProps) {
  return (
    <SubmitFailureBoundary>{(unreachable) => <OnboardingFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>
  );
}
