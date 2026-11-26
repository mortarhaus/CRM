"use client";

import { currencyExponent, formatMinor, isCurrency, isMoneyParseReason } from "@crm/core/money";
import { MONEY_MAX_MINOR } from "@crm/core/security";
import { redirect, useRouter } from "next/navigation";
import { type FormEvent, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { RenderedWorkspace } from "@/components/rendered-workspace";
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
  CATALOG_CREATE_NOT_KEPT,
  CATALOG_CREATED,
  CATALOG_CURRENCY,
  CATALOG_CURRENCY_INVALID,
  CATALOG_CURRENCY_LOCKED,
  CATALOG_CURRENCY_LOCKED_HINT,
  CATALOG_DESCRIPTION,
  CATALOG_DESCRIPTION_INVALID,
  CATALOG_EDIT_NOT_KEPT,
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
  WORKSPACE_CHANGED_MESSAGE,
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
  WORKSPACE_CHANGED: WORKSPACE_CHANGED_MESSAGE,
};

const FIELD_ERRORS: Record<string, string> = {
  name: CATALOG_NAME_INVALID,
  description: CATALOG_DESCRIPTION_INVALID,
  currency: CATALOG_CURRENCY_INVALID,
  unit: CATALOG_UNIT_INVALID,
};

// Why the price was refused: the core parser's reason and the currency it read the price in, as the action returned
// them (never the typed price). A post the action could not read that far gets the general rule, in the form's currency.
function priceError(echoed: Partial<Record<string, string>>, formCurrency: string): string {
  const reason = isMoneyParseReason(echoed.priceRefused) ? echoed.priceRefused : "invalid";
  const currency = echoed.priceCurrency !== undefined && isCurrency(echoed.priceCurrency) ? echoed.priceCurrency : formCurrency;
  return priceErrorMessage(reason, currency, currencyExponent(currency), formatMinor(MONEY_MAX_MINOR, currency, "en"));
}

// Common to both forms: a result after a post (with JavaScript or without), focus back on the button, a refresh after
// a save so the page shows the stored row and its new version.
function useSaveResult<D extends Saved>(action: FormAction<D>, unreachable: boolean, onPost?: (form: FormData) => void) {
  const [result, formAction, pending] = useActionState<SaveResult<D> | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);
  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result?.ok === false ? (REFUSALS[result.status] ?? CATALOG_FAILED) : unreachable ? CATALOG_FAILED : null;
  // Whether this browser posted the form (with JavaScript): the form is then not reset on a refusal and keeps what was
  // typed. Without JavaScript the page is rendered from the result, which carries none of the typed text.
  const [postedHere, setPostedHere] = useState(false);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPostedHere(true);
    onPost?.(form);
    startTransition(() => formAction(form));
  }
  return { result, formAction, pending, button, error, onSubmit, notKept: result?.ok === false && !postedHere };
}

interface ServiceFormProps {
  mode: "create" | "edit";
  action: FormAction;
  values: ServiceValues;
  currencies: readonly SelectOption[];
  // The workspace the page was rendered for (RenderedWorkspace).
  workspaceId: string;
}

const posted = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

interface DraftProps {
  // The values last posted from this browser (with JavaScript), or null. Kept above the failure boundary, so they
  // outlive its remount after an unreachable server; the action never sends typed text back.
  draft: ServiceValues | null;
  onDraft: (draft: ServiceValues | null) => void;
}

function ServiceFields({ mode, action, values, currencies, workspaceId, unreachable, draft, onDraft }: ServiceFormProps & DraftProps & { unreachable: boolean }) {
  const onPost = (form: FormData) =>
    onDraft({
      ...values,
      name: posted(form, "name"),
      description: posted(form, "description"),
      price: posted(form, "price"),
      currency: posted(form, "currency"),
      unit: posted(form, "unit"),
      taxable: form.get("taxable") === "on",
    });
  const { result, formAction, pending, button, error, onSubmit, notKept } = useSaveResult(action, unreachable, onPost);
  const refused = result?.ok === false && result.status === "INVALID_INPUT" ? result : null;
  const invalid = new Set(refused?.fields ?? []);
  const fieldError = (name: string) => (invalid.has(name) ? FIELD_ERRORS[name] : undefined);
  const priceMessage = invalid.has("price") ? priceError(refused?.echo ?? {}, values.currency) : undefined;
  const locked = result?.ok === false && result.status === "CURRENCY_LOCKED";
  const version = result?.ok ? Math.max(result.data.version, values.version ?? 0) : values.version;
  // The fields are mounted again only by a save (a created service starts the form again empty; a saved edit shows the
  // stored row and, after the refresh, its new version) or by another service. A refusal keeps them, as typed.
  // A currency-lock refusal puts the currency back to the stored one (Charlie, 2026-11-26, "B"); the other fields stay.
  const [saves, setSaves] = useState({ result, count: 0, locks: 0 });
  if (saves.result !== result) setSaves({ result, count: saves.count + (result?.ok ? 1 : 0), locks: saves.locks + (locked ? 1 : 0) });
  const fieldsKey = `${values.id ?? "new"}-${values.version ?? 0}-${saves.count}`;
  // After a save, the stored or initial values; otherwise this service's posted draft, if any.
  const kept = draft !== null && draft.id === values.id && draft.version === values.version ? draft : null;
  const shown = result?.ok || kept === null ? values : kept;
  useEffect(() => {
    if (result?.ok) onDraft(null);
  }, [result, onDraft]);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-6">
      <RenderedWorkspace id={workspaceId} />
      {mode === "edit" && (
        <>
          <input type="hidden" name="id" value={values.id} />
          <input type="hidden" name="expectedVersion" value={version} />
        </>
      )}
      <div key={fieldsKey} className="flex flex-col gap-6">
        <TextField id="service-name" name="name" label={CATALOG_NAME} defaultValue={shown.name} error={fieldError("name")} />
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="service-description">{CATALOG_DESCRIPTION}</Label>
          <Textarea
            id="service-description"
            name="description"
            defaultValue={shown.description}
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
          defaultValue={shown.price}
          error={priceMessage}
        />
        <SelectField
          key={`currency-${saves.locks}`}
          id="service-currency"
          name="currency"
          label={CATALOG_CURRENCY}
          hint={values.priceSet ? CATALOG_CURRENCY_LOCKED_HINT : undefined}
          options={currencies}
          defaultValue={locked ? values.currency : shown.currency}
          error={locked ? CATALOG_CURRENCY_LOCKED : fieldError("currency")}
        />
        <TextField id="service-unit" name="unit" label={CATALOG_UNIT} hint={CATALOG_UNIT_HINT} defaultValue={shown.unit} error={fieldError("unit")} />
        <div className="flex items-center gap-2">
          <input
            id="service-taxable"
            name="taxable"
            type="checkbox"
            defaultChecked={shown.taxable}
            className="size-4 accent-primary"
          />
          <Label htmlFor="service-taxable">{CATALOG_TAXABLE}</Label>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {notKept && ` ${mode === "create" ? CATALOG_CREATE_NOT_KEPT : CATALOG_EDIT_NOT_KEPT}`}
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
  const [draft, setDraft] = useState<ServiceValues | null>(null);
  return (
    <SubmitFailureBoundary>
      {(unreachable) => <ServiceFields {...props} unreachable={unreachable} draft={draft} onDraft={setDraft} />}
    </SubmitFailureBoundary>
  );
}

interface ArchiveFormProps {
  action: FormAction<Saved & { archived: boolean }>;
  values: ServiceValues;
  workspaceId: string;
}

// Archive or restore: archived_at is set or cleared, nothing is deleted (plan Q22).
function ArchiveFields({ action, values, workspaceId, unreachable }: ArchiveFormProps & { unreachable: boolean }) {
  const { result, formAction, pending, button, error, onSubmit } = useSaveResult(action, unreachable);
  const version = result?.ok ? Math.max(result.data.version, values.version ?? 0) : values.version;
  // Until the refresh arrives, the result says what the service now is.
  const archived = result?.ok ? result.data.archived : values.archived === true;

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-border pt-6">
      <RenderedWorkspace id={workspaceId} />
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
