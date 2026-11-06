"use client";

import type { Country } from "@crm/core/settings";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radio } from "@/components/ui/radio";
import type { ActionResult } from "@/lib/auth/action";
import {
  COUNTRY_NAMES,
  ONBOARDING_CHANGE_COUNTRY,
  ONBOARDING_FAILED,
  ONBOARDING_INVALID,
  ONBOARDING_NO,
  ONBOARDING_OPTIONAL_IDS,
  ONBOARDING_OWN_BRN,
  ONBOARDING_OWN_IDS_LEGEND,
  ONBOARDING_OWN_TIN,
  ONBOARDING_REGISTRATION_REQUIRED,
  ONBOARDING_SAVE,
  ONBOARDING_SAVING,
  ONBOARDING_STALE,
  ONBOARDING_TAX_HINT,
  ONBOARDING_TAX_NAME,
  ONBOARDING_TAX_NAME_REQUIRED,
  ONBOARDING_TAX_RATE,
  ONBOARDING_TAX_RATE_HINT,
  ONBOARDING_TAX_RATE_INVALID,
  ONBOARDING_TEXT_INVALID,
  ONBOARDING_YES,
  onboardingRegistrationNo,
  onboardingTaxQuestion,
  TAX_SCHEMES,
} from "@/lib/auth/messages";

type SaveResult = ActionResult<{ version: number }>;

interface FormProps {
  // completeOnboarding: called as (previous state, form data), it reads the form's fields (action() fromForm).
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  country: Country;
  // The country's tax name and rate (a percentage), preselected for a Yes and editable (spec line 732).
  taxName: string;
  taxRate: string;
  version: number;
}

const FIELD_ERRORS: Record<string, string> = {
  taxRegistrationNo: ONBOARDING_REGISTRATION_REQUIRED,
  taxName: ONBOARDING_TAX_NAME_REQUIRED,
  taxRate: ONBOARDING_TAX_RATE_INVALID,
  ownTin: ONBOARDING_TEXT_INVALID,
  ownBrn: ONBOARDING_TEXT_INVALID,
};

function formError(result: SaveResult): string {
  if (result.ok) return "";
  if (result.status === "INVALID_INPUT") return ONBOARDING_INVALID;
  return result.status === "STALE_VERSION" ? ONBOARDING_STALE : ONBOARDING_FAILED;
}

interface FieldProps {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error: string | undefined;
  defaultValue?: string;
  inputMode?: "text" | "decimal";
}

function Field({ id, name, label, hint, error, defaultValue, inputMode = "text" }: FieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <Input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function OnboardingFields({ action, country, taxName, taxRate, version, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const scheme = TAX_SCHEMES[country];

  // Done: the app takes over (its layout no longer sends the Owner here). Otherwise focus goes back to the button,
  // which was disabled while the post was in flight (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.replace("/");
    else if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result && !result.ok ? formError(result) : unreachable ? ONBOARDING_FAILED : null;
  const invalid = new Set(result?.ok === false && result.status === "INVALID_INPUT" ? result.fields : []);
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

      <fieldset className="flex flex-col gap-3" aria-describedby="tax-registered-hint">
        <legend className="mb-1 text-lg font-semibold">{onboardingTaxQuestion(scheme)}</legend>
        <p id="tax-registered-hint" className="text-sm text-muted-foreground">
          {ONBOARDING_TAX_HINT}
        </p>
        <div className="flex min-h-10 items-center gap-3">
          <Radio id="tax-registered-no" name="taxRegistered" value="no" defaultChecked />
          <Label htmlFor="tax-registered-no">{ONBOARDING_NO}</Label>
        </div>
        <div className="flex min-h-10 items-center gap-3">
          <Radio id="tax-registered-yes" name="taxRegistered" value="yes" />
          <Label htmlFor="tax-registered-yes">{ONBOARDING_YES}</Label>
        </div>
      </fieldset>

      {/* Shown only for a Yes, by CSS (no JavaScript needed). The fields are posted with a No as well and ignored. */}
      <div className="hidden flex-col gap-6 group-has-[#tax-registered-yes:checked]:flex">
        <Field
          id="tax-registration-no"
          name="taxRegistrationNo"
          label={onboardingRegistrationNo(scheme)}
          error={fieldError("taxRegistrationNo")}
        />
        <Field id="tax-name" name="taxName" label={ONBOARDING_TAX_NAME} defaultValue={taxName} error={fieldError("taxName")} />
        <Field
          id="tax-rate"
          name="taxRate"
          label={ONBOARDING_TAX_RATE}
          hint={ONBOARDING_TAX_RATE_HINT}
          defaultValue={taxRate}
          inputMode="decimal"
          error={fieldError("taxRate")}
        />
      </div>

      <fieldset className="flex flex-col gap-6" aria-describedby="own-ids-hint">
        <legend className="mb-1 text-lg font-semibold">{ONBOARDING_OWN_IDS_LEGEND}</legend>
        <p id="own-ids-hint" className="text-sm text-muted-foreground">
          {ONBOARDING_OPTIONAL_IDS}
        </p>
        <Field id="own-tin" name="ownTin" label={ONBOARDING_OWN_TIN} error={fieldError("ownTin")} />
        <Field id="own-brn" name="ownBrn" label={ONBOARDING_OWN_BRN} error={fieldError("ownBrn")} />
      </fieldset>

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
