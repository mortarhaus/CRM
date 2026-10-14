"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmTwoFactorAction, startTwoFactorAction, type TwoFactorSetupState } from "./actions";

const EMPTY_SETUP_STATE: TwoFactorSetupState = { error: null, fields: {}, enrolment: null };

export function TwoFactorSetup({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [started, startAction, starting] = useActionState(startTwoFactorAction, EMPTY_SETUP_STATE);
  const [confirmed, confirmAction, confirming] = useActionState(confirmTwoFactorAction, EMPTY_SETUP_STATE);
  // A refused code hands the enrolment back, so a page rendered without JavaScript still shows it.
  const enrolment = confirmed.enrolment ?? started.enrolment;
  const firstStepHeading = useRef<HTMLHeadingElement>(null);

  // The password form that held focus is replaced by the enrolment steps; move focus to step 1.
  useEffect(() => {
    if (started.enrolment) firstStepHeading.current?.focus();
  }, [started.enrolment]);

  if (initiallyEnabled) {
    return (
      <p role="status" className="text-sm">
        Two-factor authentication is on.
      </p>
    );
  }

  if (!enrolment) {
    return (
      <form action={startAction} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Protect your account with a code from an authenticator app. Confirm your password to start.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={started.error ? true : undefined}
            aria-describedby={started.error ? "two-factor-setup-error" : undefined}
          />
        </div>
        {started.error && (
          <p id="two-factor-setup-error" role="alert" className="text-sm text-destructive">
            {started.error}
          </p>
        )}
        <Button type="submit" disabled={starting}>
          Set up two-factor authentication
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3
          ref={firstStepHeading}
          tabIndex={-1}
          className="rounded-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          1. Add this account to your authenticator app
        </h3>
        <p className="text-sm text-muted-foreground">Enter this setup key in your authenticator app:</p>
        <code className="break-all rounded-md bg-muted p-3 font-mono text-sm">{enrolment.setupKey}</code>
        <details className="text-sm">
          <summary className="cursor-pointer rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
            Show the full setup link
          </summary>
          <code data-testid="totp-uri" className="mt-2 block break-all rounded-md bg-muted p-3 font-mono">
            {enrolment.totpURI}
          </code>
        </details>
      </div>
      <div className="flex flex-col gap-2">
        <h3 id="recovery-codes-heading" className="font-medium">
          2. Save your recovery codes
        </h3>
        <p className="text-sm text-muted-foreground">
          Each code works once if you lose your authenticator. Store them somewhere safe; they are not shown again.
        </p>
        <ol aria-labelledby="recovery-codes-heading" className="grid grid-cols-2 gap-2 font-mono text-sm">
          {enrolment.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>
      </div>
      <form action={confirmAction} className="flex flex-col gap-4">
        <h3 className="font-medium">3. Enter the 6-digit code from the app</h3>
        <input type="hidden" name="totpURI" value={enrolment.totpURI} />
        {enrolment.backupCodes.map((code) => (
          <input key={code} type="hidden" name="backupCode" value={code} />
        ))}
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
            aria-invalid={confirmed.error ? true : undefined}
            aria-describedby={confirmed.error ? "two-factor-confirm-error" : undefined}
          />
        </div>
        {confirmed.error && (
          <p id="two-factor-confirm-error" role="alert" className="text-sm text-destructive">
            {confirmed.error}
          </p>
        )}
        <Button type="submit" disabled={confirming}>
          Verify and turn on
        </Button>
      </form>
    </div>
  );
}
