"use client";

import { redirect, useRouter } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from "react";
import { type SelectOption, SelectField, TextField } from "@/components/settings/settings-field";
import { TAX_FIELD_ERRORS, TaxFields } from "@/components/settings/tax-fields";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/auth/action";
import {
  GENERAL_ADDRESS_CITY,
  GENERAL_ADDRESS_INVALID,
  GENERAL_ADDRESS_LINE1,
  GENERAL_ADDRESS_LINE2,
  GENERAL_ADDRESS_POSTCODE,
  GENERAL_ADDRESS_STATE,
  GENERAL_BASE_CURRENCY,
  GENERAL_BUSINESS_LEGEND,
  GENERAL_CHOICE_INVALID,
  GENERAL_COUNTRY,
  GENERAL_DATE_FORMAT,
  GENERAL_DEFAULT_CURRENCY,
  GENERAL_FAILED,
  GENERAL_FORBIDDEN,
  GENERAL_OPTIONAL,
  GENERAL_REGIONAL_LEGEND,
  GENERAL_SAVE,
  GENERAL_SAVED,
  GENERAL_SAVED_NEW_DOCUMENTS,
  GENERAL_SAVING,
  GENERAL_SHORT_CODE,
  GENERAL_SHORT_CODE_HINT,
  GENERAL_SHORT_CODE_INVALID,
  GENERAL_STALE,
  GENERAL_TIMEZONE,
  NEW_DOCUMENTS_ONLY,
  ONBOARDING_INVALID,
  ONBOARDING_TEXT_INVALID,
  SETUP_PENDING,
} from "@/lib/auth/messages";

type SaveResult = ActionResult<{ version: number; newDocumentsOnly: boolean }>;

export interface GeneralValues {
  version: number;
  countryName: string;
  scheme: string;
  shortCode?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressPostcode?: string;
  addressState?: string;
  timezone?: string;
  dateFormat?: string;
  baseCurrency?: string;
  defaultCurrency?: string;
  taxRegistered: boolean;
  taxRegistrationNo?: string;
  taxName: string;
  taxRate: string;
  ownTin?: string;
  ownBrn?: string;
}

interface FormProps {
  // updateGeneralSettings: called as (previous state, form data), it reads the whole form (action() fromForm).
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  values: GeneralValues;
  timeZones: readonly string[];
  dateFormats: readonly SelectOption[];
  currencies: readonly string[];
}

const FIELD_ERRORS: Record<string, string> = {
  ...TAX_FIELD_ERRORS,
  shortCode: GENERAL_SHORT_CODE_INVALID,
  addressLine1: GENERAL_ADDRESS_INVALID,
  addressLine2: GENERAL_ADDRESS_INVALID,
  addressCity: ONBOARDING_TEXT_INVALID,
  addressPostcode: ONBOARDING_TEXT_INVALID,
  addressState: ONBOARDING_TEXT_INVALID,
  timezone: GENERAL_CHOICE_INVALID,
  dateFormat: GENERAL_CHOICE_INVALID,
  baseCurrency: GENERAL_CHOICE_INVALID,
  defaultCurrency: GENERAL_CHOICE_INVALID,
};

const REFUSALS: Partial<Record<string, string>> = {
  INVALID_INPUT: ONBOARDING_INVALID,
  STALE_VERSION: GENERAL_STALE,
  FORBIDDEN: GENERAL_FORBIDDEN,
  NOT_ONBOARDED: SETUP_PENDING,
};

function GeneralFields({ action, values, timeZones, dateFormats, currencies, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);

  // A save is rendered again from the stored row (the version moves on). Focus goes back to the button, which was
  // disabled while the post was in flight (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result?.ok === false ? (REFUSALS[result.status] ?? GENERAL_FAILED) : unreachable ? GENERAL_FAILED : null;
  const refused = result?.ok === false && result.status === "INVALID_INPUT" ? result : null;
  const invalid = new Set(refused?.fields ?? []);
  const fieldError = (name: string) => (invalid.has(name) ? FIELD_ERRORS[name] : undefined);
  // Without JavaScript the page is rendered from the result: what the action echoed (no personal data) comes back as
  // typed, the rest as stored. With JavaScript the form is not reset (onSubmit), so it keeps what was typed.
  const echoed: Partial<Record<string, string>> = refused?.echo ?? {};
  const value = (name: keyof GeneralValues) => echoed[name] ?? (values[name] as string | undefined);
  const yes = echoed.taxRegistered ? echoed.taxRegistered === "yes" : values.taxRegistered;
  // Until the refresh arrives, the version the save returned is the current one.
  const version = result?.ok ? Math.max(result.data.version, values.version) : values.version;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  }

  const text = (name: keyof GeneralValues, id: string, label: string, hint?: string) => (
    <TextField id={id} name={name} label={label} hint={hint} defaultValue={value(name)} error={fieldError(name)} />
  );
  const choice = (name: keyof GeneralValues, id: string, label: string, options: readonly SelectOption[], hint?: string) => (
    <SelectField id={id} name={name} label={label} hint={hint} options={options} defaultValue={value(name)} error={fieldError(name)} />
  );

  return (
    <form action={formAction} onSubmit={onSubmit} className="group flex flex-col gap-8">
      <input type="hidden" name="expectedVersion" value={version} />
      <p>
        <span className="text-sm text-muted-foreground">{GENERAL_COUNTRY}: </span>
        <span className="font-semibold">{values.countryName}</span>
      </p>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-1 text-lg font-semibold">{GENERAL_BUSINESS_LEGEND}</legend>
        {text("shortCode", "short-code", GENERAL_SHORT_CODE, GENERAL_SHORT_CODE_HINT)}
        {text("addressLine1", "address-line1", GENERAL_ADDRESS_LINE1)}
        {text("addressLine2", "address-line2", GENERAL_ADDRESS_LINE2)}
        {text("addressCity", "address-city", GENERAL_ADDRESS_CITY)}
        {text("addressPostcode", "address-postcode", GENERAL_ADDRESS_POSTCODE)}
        {text("addressState", "address-state", GENERAL_ADDRESS_STATE)}
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-1 text-lg font-semibold">{GENERAL_REGIONAL_LEGEND}</legend>
        {choice("timezone", "timezone", GENERAL_TIMEZONE, timeZones)}
        {choice("dateFormat", "date-format", GENERAL_DATE_FORMAT, dateFormats)}
        {choice("baseCurrency", "base-currency", GENERAL_BASE_CURRENCY, currencies, NEW_DOCUMENTS_ONLY)}
        {choice("defaultCurrency", "default-currency", GENERAL_DEFAULT_CURRENCY, currencies)}
      </fieldset>

      <TaxFields
        scheme={values.scheme}
        taxHint={NEW_DOCUMENTS_ONLY}
        idsHint={GENERAL_OPTIONAL}
        yes={yes}
        values={{
          registrationNo: values.taxRegistrationNo,
          taxName: value("taxName"),
          taxRate: value("taxRate"),
          ownTin: values.ownTin,
          ownBrn: values.ownBrn,
        }}
        fieldError={fieldError}
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm" data-new-documents-only={result.data.newDocumentsOnly}>
          {result.data.newDocumentsOnly ? GENERAL_SAVED_NEW_DOCUMENTS : GENERAL_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? GENERAL_SAVING : GENERAL_SAVE}
      </Button>
    </form>
  );
}

export function GeneralForm(props: FormProps) {
  return (
    <SubmitFailureBoundary>{(unreachable) => <GeneralFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>
  );
}
