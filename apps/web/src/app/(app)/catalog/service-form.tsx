"use client";

import { currencyExponent, formatMinor, isCurrency, MoneyParseError, parseDecimalToMinor } from "@crm/core/money";
import { MONEY_MAX_MINOR } from "@crm/core/security";
import { redirect, useRouter } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef } from "react";
import { type SelectOption, SelectField, TextField } from "@/components/settings/settings-field";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/auth/action";
import {
  CATALOG_ARCHIVE,
  CATALOG_ARCHIVE_HINT,
  CATALOG_ARCHIVED,
  CATALOG_CREATE,
  CATALOG_CREATED,
  CATALOG_CURRENCY,
  CATALOG_CURRENCY_INVALID,
  CATALOG_CURRENCY_LOCKED,
  CATALOG_CURRENCY_LOCKED_HINT,
  CATALOG_DESCRIPTION,
  CATALOG_DESCRIPTION_INVALID,
  CATALOG_FAILED,
  CATALOG_FORBIDDEN,
  CATALOG_INVALID,
  CATALOG_IS_ARCHIVED,
  CATALOG_NAME,
  CATALOG_NAME_INVALID,
  CATALOG_NOT_FOUND,
  CATALOG_PRICE,
  CATALOG_PRICE_HINT,
  CATALOG_RESTORE,
  CATALOG_RESTORED,
  CATALOG_SAVE,
  CATALOG_SAVED,
  CATALOG_SAVING,
  CATALOG_STALE,
  CATALOG_TAXABLE,
  CATALOG_UNIT,
  CATALOG_UNIT_HINT,
  CATALOG_UNIT_INVALID,
  priceErrorMessage,
} from "@/lib/auth/messages";

type Saved = { id: string; version: number };
type SaveResult<D extends Saved = Saved> = ActionResult<D>;
// A catalog action, called as (previous state, form data): it reads the form (action() fromForm).
type FormAction<D extends Saved = Saved> = (previous: SaveResult<D> | null, form: FormData) => Promise<SaveResult<D>>;

export interface ServiceValues {
  id?: string;
  version?: number;
  name: string;
  description: string;
  // The stored price as a plain decimal in the currency's exponent, or "" for none.
  price: string;
  currency: string;
  unit: string;
  taxable: boolean;
  // Whether the stored row has a default price: its currency is then locked.
  priceSet?: boolean;
  archived?: boolean;
}

const REFUSALS: Partial<Record<string, string>> = {
  INVALID_INPUT: CATALOG_INVALID,
  STALE_VERSION: CATALOG_STALE,
  FORBIDDEN: CATALOG_FORBIDDEN,
  NOT_FOUND: CATALOG_NOT_FOUND,
  CURRENCY_LOCKED: CATALOG_CURRENCY_LOCKED,
};

const FIELD_ERRORS: Record<string, string> = {
  name: CATALOG_NAME_INVALID,
  description: CATALOG_DESCRIPTION_INVALID,
  currency: CATALOG_CURRENCY_INVALID,
  unit: CATALOG_UNIT_INVALID,
};

// Why the price was refused, by the same core parser the action ran, on the price and currency it echoed.
function priceError(price: string, currency: string): string | undefined {
  if (!isCurrency(currency)) return undefined;
  try {
    parseDecimalToMinor(price, currency);
    return undefined;
  } catch (error) {
    if (!(error instanceof MoneyParseError)) throw error;
    return priceErrorMessage(error.reason, currency, currencyExponent(currency), formatMinor(MONEY_MAX_MINOR, currency, "en"));
  }
}

// Common to both forms: a result after a post (with JavaScript or without), focus back on the button, a refresh after
// a save so the page shows the stored row and its new version.
function useSaveResult<D extends Saved>(action: FormAction<D>, unreachable: boolean) {
  const [result, formAction, pending] = useActionState<SaveResult<D> | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);
  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result?.ok === false ? (REFUSALS[result.status] ?? CATALOG_FAILED) : unreachable ? CATALOG_FAILED : null;
  // The form is not reset on a refusal (with JavaScript); without it the page is rendered from the result.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  }
  return { result, formAction, pending, button, error, onSubmit };
}

interface ServiceFormProps {
  mode: "create" | "edit";
  action: FormAction;
  values: ServiceValues;
  currencies: readonly SelectOption[];
}

function ServiceFields({ mode, action, values, currencies, unreachable }: ServiceFormProps & { unreachable: boolean }) {
  const { result, formAction, pending, button, error, onSubmit } = useSaveResult(action, unreachable);
  const refused = result?.ok === false && result.status === "INVALID_INPUT" ? result : null;
  const echoed: Partial<Record<string, string>> = refused?.echo ?? {};
  const value = (name: "name" | "description" | "price" | "currency" | "unit") => echoed[name] ?? values[name];
  const invalid = new Set(refused?.fields ?? []);
  const fieldError = (name: string) => (invalid.has(name) ? FIELD_ERRORS[name] : undefined);
  const priceMessage = invalid.has("price") ? priceError(value("price"), value("currency")) : undefined;
  const locked = result?.ok === false && result.status === "CURRENCY_LOCKED";
  // A created service starts the form again empty; a saved edit shows the stored row (its new version).
  const version = result?.ok ? Math.max(result.data.version, values.version ?? 0) : values.version;
  const fieldsKey = `${values.version ?? "new"}-${result?.ok ? result.data.id : ""}`;

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6">
      {mode === "edit" && (
        <>
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="expectedVersion" value={version} />
        </>
      )}
      <div key={fieldsKey} className="flex flex-col gap-6">
        <TextField id="service-name" name="name" label={CATALOG_NAME} defaultValue={value("name")} error={fieldError("name")} />
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="service-description">{CATALOG_DESCRIPTION}</Label>
          <Textarea
            id="service-description"
            name="description"
            defaultValue={value("description")}
            aria-invalid={fieldError("description") ? true : undefined}
            aria-describedby={fieldError("description") ? "service-description-error" : undefined}
          />
          {fieldError("description") && (
            <p id="service-description-error" className="text-sm text-destructive">
              {fieldError("description")}
            </p>
          )}
        </div>
        <TextField
          id="service-price"
          name="price"
          label={CATALOG_PRICE}
          hint={CATALOG_PRICE_HINT}
          inputMode="decimal"
          defaultValue={value("price")}
          error={priceMessage}
        />
        <SelectField
          id="service-currency"
          name="currency"
          label={CATALOG_CURRENCY}
          hint={values.priceSet ? CATALOG_CURRENCY_LOCKED_HINT : undefined}
          options={currencies}
          defaultValue={value("currency")}
          error={locked ? CATALOG_CURRENCY_LOCKED : fieldError("currency")}
        />
        <TextField id="service-unit" name="unit" label={CATALOG_UNIT} hint={CATALOG_UNIT_HINT} defaultValue={value("unit")} error={fieldError("unit")} />
        <div className="flex items-center gap-2">
          <input
            id="service-taxable"
            name="taxable"
            type="checkbox"
            defaultChecked={refused ? echoed.taxable === "on" : values.taxable}
            className="size-4 accent-primary"
          />
          <Label htmlFor="service-taxable">{CATALOG_TAXABLE}</Label>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {mode === "create" ? CATALOG_CREATED : CATALOG_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? CATALOG_SAVING : mode === "create" ? CATALOG_CREATE : CATALOG_SAVE}
      </Button>
    </form>
  );
}

export function ServiceForm(props: ServiceFormProps) {
  return <SubmitFailureBoundary>{(unreachable) => <ServiceFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}

interface ArchiveFormProps {
  action: FormAction<Saved & { archived: boolean }>;
  values: ServiceValues;
}

// Archive or restore: archived_at is set or cleared, nothing is deleted (plan Q22).
function ArchiveFields({ action, values, unreachable }: ArchiveFormProps & { unreachable: boolean }) {
  const { result, formAction, pending, button, error, onSubmit } = useSaveResult(action, unreachable);
  const version = result?.ok ? Math.max(result.data.version, values.version ?? 0) : values.version;
  // Until the refresh arrives, the result says what the service now is.
  const archived = result?.ok ? result.data.archived : values.archived === true;

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border pt-6">
      <input type="hidden" name="id" value={values.id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="archived" value={archived ? "false" : "true"} />
      <p className="text-sm text-muted-foreground">{archived ? CATALOG_IS_ARCHIVED : CATALOG_ARCHIVE_HINT}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {archived ? CATALOG_ARCHIVED : CATALOG_RESTORED}
        </p>
      )}
      <Button ref={button} type="submit" variant="outline" disabled={pending} className="self-start">
        {pending ? CATALOG_SAVING : archived ? CATALOG_RESTORE : CATALOG_ARCHIVE}
      </Button>
    </form>
  );
}

export function ArchiveForm(props: ArchiveFormProps) {
  return <SubmitFailureBoundary>{(unreachable) => <ArchiveFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}
