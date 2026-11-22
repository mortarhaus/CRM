"use client";

import { redirect, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/auth/action";
import {
  BANK_ACCOUNT_HOLDER,
  BANK_ACCOUNT_NUMBER,
  BANK_FAILED,
  BANK_FIELD_INVALID,
  BANK_NAME,
  BANK_SAVE,
  BANK_SAVED,
  BANK_SAVING,
  BANK_STALE,
  BANK_SWIFT_CODE,
  BANK_SWIFT_HINT,
  BANK_SWIFT_INVALID,
  ONBOARDING_INVALID,
  PAYMENT_FORBIDDEN,
  STEP_UP_NEEDED,
} from "@/lib/auth/messages";

export type SaveResult = ActionResult<{ version: number }>;

export interface BankDetails {
  bankName: string | null;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankSwiftCode: string | null;
}

interface FormProps {
  // saveBankDetails: called as (previous state, form data); it reads the fields from the form (fromForm).
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  version: number;
  saved: BankDetails;
}

const MESSAGES: Partial<Record<Exclude<SaveResult, { ok: true }>["status"], string>> = {
  STEP_UP_REQUIRED: STEP_UP_NEEDED,
  STALE_VERSION: BANK_STALE,
  FORBIDDEN: PAYMENT_FORBIDDEN,
};

// Plan Q17 (Charlie 2026-11-22): these three are required; the SWIFT code is optional.
const FIELDS = [
  { name: "bankName", label: BANK_NAME },
  { name: "bankAccountHolder", label: BANK_ACCOUNT_HOLDER },
  { name: "bankAccountNumber", label: BANK_ACCOUNT_NUMBER },
] as const;

const ERROR_ID = "bank-details-error";

function BankFields({ action, version, saved, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);

  // Saved: the page is rendered again with the stored values. Focus goes back to the button (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const invalid = new Set(result?.ok === false && result.status === "INVALID_INPUT" ? result.fields : []);
  const refused = result?.ok === false && result.status !== "INVALID_INPUT" ? (MESSAGES[result.status] ?? BANK_FAILED) : null;
  const error = refused ?? (invalid.size > 0 ? ONBOARDING_INVALID : unreachable ? BANK_FAILED : null);
  const currentVersion = result?.ok ? Math.max(result.data.version, version) : version;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="expectedVersion" value={currentVersion} />
      {FIELDS.map((field) => (
        <div key={field.name} className="flex max-w-sm flex-col gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            defaultValue={saved[field.name] ?? ""}
            autoComplete="off"
            required
            aria-invalid={invalid.has(field.name) ? true : undefined}
            aria-describedby={invalid.has(field.name) ? `${field.name}-error` : undefined}
          />
          {invalid.has(field.name) && (
            <p id={`${field.name}-error`} className="text-sm text-destructive">
              {BANK_FIELD_INVALID}
            </p>
          )}
        </div>
      ))}
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="bankSwiftCode">{BANK_SWIFT_CODE}</Label>
        <p id="bankSwiftCode-hint" className="text-sm text-muted-foreground">
          {BANK_SWIFT_HINT}
        </p>
        <Input
          id="bankSwiftCode"
          name="bankSwiftCode"
          defaultValue={saved.bankSwiftCode ?? ""}
          autoComplete="off"
          aria-invalid={invalid.has("bankSwiftCode") ? true : undefined}
          aria-describedby={invalid.has("bankSwiftCode") ? "bankSwiftCode-hint bankSwiftCode-error" : "bankSwiftCode-hint"}
        />
        {invalid.has("bankSwiftCode") && (
          <p id="bankSwiftCode-error" className="text-sm text-destructive">
            {BANK_SWIFT_INVALID}
          </p>
        )}
      </div>
      {error && (
        <p id={ERROR_ID} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {BANK_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? BANK_SAVING : BANK_SAVE}
      </Button>
    </form>
  );
}

export function BankDetailsForm(props: FormProps) {
  return <SubmitFailureBoundary>{(unreachable) => <BankFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}
