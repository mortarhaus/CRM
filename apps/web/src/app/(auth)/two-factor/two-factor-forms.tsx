"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_FORM_STATE } from "@/lib/forms";
import { verifyTwoFactorAction } from "./actions";

export function TwoFactorForms() {
  const [state, formAction, pending] = useActionState(verifyTwoFactorAction, EMPTY_FORM_STATE);
  const describedBy = state.error ? "two-factor-error" : undefined;

  return (
    <div className="flex flex-col gap-8">
      {state.error && (
        <p id="two-factor-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <section aria-labelledby="authenticator-heading" className="flex flex-col gap-4">
        <h2 id="authenticator-heading" className="text-lg font-semibold">
          Authenticator app
        </h2>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="method" value="totp" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="totp-code">Authentication code</Label>
            <Input
              id="totp-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              aria-describedby={describedBy}
            />
          </div>
          <Button type="submit" disabled={pending}>
            Verify
          </Button>
        </form>
      </section>
      <section aria-labelledby="recovery-heading" className="flex flex-col gap-4">
        <h2 id="recovery-heading" className="text-lg font-semibold">
          Recovery code
        </h2>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="method" value="recovery" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="recovery-code">Recovery code</Label>
            <Input
              id="recovery-code"
              name="code"
              type="text"
              autoComplete="off"
              required
              aria-describedby={describedBy}
            />
          </div>
          <Button type="submit" variant="outline" disabled={pending}>
            Use recovery code
          </Button>
        </form>
      </section>
    </div>
  );
}
