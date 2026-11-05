"use client";

import { type Hsv, hexToHsv, hsvToHex, isHexColour } from "@crm/core/branding";
import { redirect, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ColourPicker } from "@/components/settings/colour-picker";
import { SubmitFailureBoundary } from "@/components/submit-failure-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/auth/action";
import {
  BRANDING_FAILED,
  BRANDING_FORBIDDEN,
  BRANDING_HINT,
  BRANDING_INVALID,
  BRANDING_SAVED,
  BRANDING_STALE,
  SAVE_BRANDING,
  SAVING_BRANDING,
} from "@/lib/auth/messages";
import { BrandPreview } from "./brand-preview";

type SaveResult = ActionResult<{ version: number }>;

interface FormProps {
  // updateBrandingSettings: called as (previous state, form data), it reads the form's fields (action() fromForm).
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
  // The stored colour (or the default) and the settings version it was read at.
  saved: string;
  version: number;
}

const ERROR_ID = "branding-error";
const HINT_ID = "brand-colour-hint";

function errorFor(result: SaveResult): string | null {
  if (result.ok) return null;
  if (result.status === "INVALID_INPUT") return BRANDING_INVALID;
  if (result.status === "STALE_VERSION") return BRANDING_STALE;
  return result.status === "FORBIDDEN" ? BRANDING_FORBIDDEN : BRANDING_FAILED;
}

const normalised = (text: string) => text.trim().toLowerCase();

// The picker works in whole degrees and percent, as its sliders announce them.
function pickerValue(hex: string): Hsv {
  const { h, s, v } = hexToHsv(hex);
  return { h: Math.round(h) % 360, s: Math.round(s), v: Math.round(v) };
}
const subscribeToNothing = () => () => {};

function BrandingFields({ action, saved, version, unreachable }: FormProps & { unreachable: boolean }) {
  const [result, formAction, pending] = useActionState<SaveResult | null, FormData>(action, null);
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState(saved);
  const [hsv, setHsv] = useState<Hsv>(() => pickerValue(saved));
  // The drag picker needs JavaScript, so it is rendered only once the page is hydrated; the hex field works without.
  const hydrated = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  // A save changes the token the app layout renders, so the page is rendered again. Focus goes back to the button,
  // which was disabled while the post was in flight (A11Y-01).
  useEffect(() => {
    if (result?.ok) router.refresh();
    if (result !== null || unreachable) button.current?.focus();
  }, [result, unreachable, router]);

  if (result?.ok === false && result.status === "UNAUTHENTICATED") redirect("/sign-in");
  const error = result ? errorFor(result) : unreachable ? BRANDING_FAILED : null;
  // Until the refresh arrives, the version the save returned is the current one.
  const currentVersion = result?.ok ? Math.max(result.data.version, version) : version;
  const typed = normalised(text);
  const preview = isHexColour(typed) ? typed : saved;

  function onTextChange(value: string) {
    setText(value);
    const hex = normalised(value);
    if (!isHexColour(hex)) return;
    // A grey or black has no hue (and black no saturation): keep the picker's, so it does not jump to red.
    const next = pickerValue(hex);
    setHsv((current) => ({ h: next.s === 0 || next.v === 0 ? current.h : next.h, s: next.v === 0 ? current.s : next.s, v: next.v }));
  }

  function onPick(next: Hsv) {
    setHsv(next);
    setText(hsvToHex(next));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="expectedVersion" value={currentVersion} />
      <div className="flex max-w-xs flex-col gap-2">
        <Label htmlFor="brand-colour">Brand colour</Label>
        <p id={HINT_ID} className="text-sm text-muted-foreground">
          {BRANDING_HINT}
        </p>
        <Input
          id="brand-colour"
          name="brandColour"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          required
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          aria-invalid={result?.ok === false && result.status === "INVALID_INPUT" ? true : undefined}
          aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
          className="font-mono"
        />
      </div>
      {hydrated && <ColourPicker value={hsv} onChange={onPick} />}
      <BrandPreview colour={preview} />
      {error && (
        <p id={ERROR_ID} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result?.ok && (
        <p role="status" className="text-sm">
          {BRANDING_SAVED}
        </p>
      )}
      <Button ref={button} type="submit" disabled={pending} className="self-start">
        {pending ? SAVING_BRANDING : SAVE_BRANDING}
      </Button>
    </form>
  );
}

export function BrandingForm(props: FormProps) {
  return (
    <SubmitFailureBoundary>{(unreachable) => <BrandingFields {...props} unreachable={unreachable} />}</SubmitFailureBoundary>
  );
}
