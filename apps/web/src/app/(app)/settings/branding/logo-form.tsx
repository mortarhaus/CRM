"use client";

import { LOGO_MAX_BYTES } from "@crm/core/security";
import { redirect, useRouter } from "next/navigation";
import { type FormEvent, useActionState, useEffect, useRef, useState } from "react";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/auth/action";
import {
  BRANDING_FORBIDDEN,
  BRANDING_STALE,
  LOGO_EMPTY,
  LOGO_FAILED,
  LOGO_HINT,
  LOGO_LABEL,
  LOGO_SAVED,
  LOGO_TOO_LARGE,
  LOGO_TYPE_NOT_ALLOWED,
  LOGO_UNAVAILABLE,
  UPLOAD_LOGO,
  UPLOADING_LOGO,
} from "@/lib/auth/messages";

type UploadResult = ActionResult<{ version: number }>;

interface FormProps {
  // uploadLogo: called as (previous state, form data); it reads the file and the version from the form (fromForm).
  action: (previous: UploadResult | null, form: FormData) => Promise<UploadResult>;
  // The settings version the page was read at (optimistic concurrency, shared with the colour form).
  version: number;
}

const ERROR_ID = "logo-error";
const HINT_ID = "logo-hint";

const MESSAGES: Partial<Record<Exclude<UploadResult, { ok: true }>["status"], string>> = {
  INVALID_INPUT: LOGO_EMPTY,
  UPLOAD_EMPTY: LOGO_EMPTY,
  UPLOAD_TOO_LARGE: LOGO_TOO_LARGE,
  UPLOAD_TYPE_NOT_ALLOWED: LOGO_TYPE_NOT_ALLOWED,
  STORAGE_UNAVAILABLE: LOGO_UNAVAILABLE,
  STALE_VERSION: BRANDING_STALE,
  FORBIDDEN: BRANDING_FORBIDDEN,
};

function LogoFields({ action, version, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<UploadResult | null, FormData>(action, null);
  // A file over the limit is refused here before it is sent (with JavaScript); the server checks again.
  const [tooLarge, setTooLarge] = useState(false);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);

  // A new logo changes the image the page shows, so the page is rendered again. Focus goes back to the button (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const refused = result?.ok === false ? (MESSAGES[result.status] ?? LOGO_FAILED) : null;
  const error = tooLarge ? LOGO_TOO_LARGE : (refused ?? (unreachable ? LOGO_FAILED : null));
  const currentVersion = result?.ok ? Math.max(result.data.version, version) : version;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const file = new FormData(event.currentTarget).get("logo");
    const over = file instanceof File && file.size > LOGO_MAX_BYTES;
    setTooLarge(over);
    if (over) {
      event.preventDefault();
      button.current?.focus();
    }
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="expectedVersion" value={currentVersion} />
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="logo">{LOGO_LABEL}</Label>
        <p id={HINT_ID} className="text-sm text-muted-foreground">
          {LOGO_HINT}
        </p>
        {/* accept only filters the picker; the server reads the bytes and ignores the type and name sent. */}
        <Input
          id="logo"
          name="logo"
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
          {LOGO_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? UPLOADING_LOGO : UPLOAD_LOGO}
      </Button>
    </form>
  );
}

export function LogoForm(props: FormProps) {
  return <SubmitFailureBoundary>{(unreachable) => <LogoFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>;
}
