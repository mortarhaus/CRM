"use client";

import { PAYMENT_QR_MAX_BYTES } from "@crm/core/security";
import { redirect } from "next/navigation";
import { type FormEvent, useActionState, useState } from "react";
import { RenderedWorkspace } from "@/components/rendered-workspace";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BANK_STALE,
  PAYMENT_CHANGE_FORBIDDEN,
  PAYMENT_QR_EMPTY,
  PAYMENT_QR_FAILED,
  PAYMENT_QR_HINT,
  PAYMENT_QR_SAVED,
  PAYMENT_QR_TOO_LARGE,
  PAYMENT_QR_TYPE_NOT_ALLOWED,
  PAYMENT_QR_UNAVAILABLE,
  PAYMENT_QR_UPLOAD,
  PAYMENT_QR_UPLOADING,
  paymentQrLabel,
  WORKSPACE_CHANGED_MESSAGE,
} from "@/lib/auth/messages";
import type { SaveResult } from "./bank-details-form";
import { stepUpRefusal } from "./save-follow-up";
import { useSaveFollowUp, useStepUpRefusal } from "./use-save-follow-up";

interface FormProps {
  // uploadPaymentQr: called as (previous state, form data); it reads the file and the version from the form.
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  version: number;
  // DuitNow QR or PayNow QR, by the workspace country.
  name: string;
  // The page showed "Confirmed" (step-up fresh when it was rendered).
  steppedUp: boolean;
  // The workspace the page was rendered for (RenderedWorkspace).
  workspaceId: string;
}

const ERROR_ID = "qr-error";
const HINT_ID = "qr-hint";

const MESSAGES: Partial<Record<Exclude<SaveResult, { ok: true }>["status"], string>> = {
  INVALID_INPUT: PAYMENT_QR_EMPTY,
  UPLOAD_EMPTY: PAYMENT_QR_EMPTY,
  UPLOAD_TOO_LARGE: PAYMENT_QR_TOO_LARGE,
  UPLOAD_TYPE_NOT_ALLOWED: PAYMENT_QR_TYPE_NOT_ALLOWED,
  STORAGE_UNAVAILABLE: PAYMENT_QR_UNAVAILABLE,
  STALE_VERSION: BANK_STALE,
  FORBIDDEN: PAYMENT_CHANGE_FORBIDDEN,
  WORKSPACE_CHANGED: WORKSPACE_CHANGED_MESSAGE,
};

// As the logo form (settings/branding): a file over the limit is refused here before it is sent; the server checks
// the size, the bytes and step-up again.
function QrFields({ action, version, name, steppedUp, workspaceId, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const [tooLarge, setTooLarge] = useState(false);
  const [confirmedAtSubmit, setConfirmedAtSubmit] = useState(false);
  const button = useSaveFollowUp(result, unreachable);
  const stepUpRefused = useStepUpRefusal(result, steppedUp);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const refused = stepUpRefused
    ? stepUpRefusal(confirmedAtSubmit)
    : result?.ok === false && result.status !== "STEP_UP_REQUIRED"
      ? (MESSAGES[result.status] ?? PAYMENT_QR_FAILED)
      : null;
  const error = tooLarge ? PAYMENT_QR_TOO_LARGE : (refused ?? (unreachable ? PAYMENT_QR_FAILED : null));
  const currentVersion = result?.ok ? Math.max(result.data.version, version) : version;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const qr = new FormData(event.currentTarget).get("qr");
    const over = qr instanceof File && qr.size > PAYMENT_QR_MAX_BYTES;
    setTooLarge(over);
    setConfirmedAtSubmit(steppedUp);
    if (over) {
      event.preventDefault();
      button.current?.focus();
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <RenderedWorkspace id={workspaceId} />
      <input type="hidden" name="expectedVersion" value={currentVersion} />
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="qr">{paymentQrLabel(name)}</Label>
        <p id={HINT_ID} className="text-sm text-muted-foreground">
          {PAYMENT_QR_HINT}
        </p>
        {/* accept only filters the picker; the server reads the bytes and ignores the type and name sent. */}
        <Input
          id="qr"
          name="qr"
          type="file"
          accept="image/png,image/jpeg"
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
      {result?.ok && !tooLarge && (
        <p role="status" className="text-sm">
          {PAYMENT_QR_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? PAYMENT_QR_UPLOADING : PAYMENT_QR_UPLOAD}
      </Button>
    </form>
  );
}

export function PaymentQrForm(props: FormProps) {
  return <SubmitFailureBoundary>{(unreachable) => <QrFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}
