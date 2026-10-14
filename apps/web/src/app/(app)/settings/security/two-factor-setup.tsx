"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY_ATTEMPTS, WRONG_CODE } from "@/lib/auth/messages";

interface Enrolment {
  totpURI: string;
  setupKey: string;
  backupCodes: string[];
}

export function TwoFactorSetup({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const firstStepHeading = useRef<HTMLHeadingElement>(null);

  // The password form that held focus is replaced by the enrolment steps; move focus to step 1.
  useEffect(() => {
    if (enrolment) firstStepHeading.current?.focus();
  }, [enrolment]);

  async function startEnrolment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { data, error: enableError } = await authClient.twoFactor.enable({
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (enableError || !data || !("totpURI" in data)) {
      setError(enableError?.status === 429 ? TOO_MANY_ATTEMPTS : "Your password didn't match. Try again.");
      return;
    }
    setEnrolment({
      totpURI: data.totpURI,
      setupKey: new URL(data.totpURI).searchParams.get("secret") ?? "",
      backupCodes: data.backupCodes,
    });
  }

  async function confirmEnrolment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code: String(form.get("code") ?? "").trim(),
    });
    setPending(false);
    if (verifyError) {
      setError(verifyError.status === 429 ? TOO_MANY_ATTEMPTS : WRONG_CODE);
      return;
    }
    setEnabled(true);
    router.refresh();
  }

  if (enabled) {
    return (
      <p role="status" className="text-sm">
        Two-factor authentication is on.
      </p>
    );
  }

  if (!enrolment) {
    return (
      // Enrolment still needs JavaScript (FE-32 follow-up). POST keeps a no-script submit from putting the
      // password in the URL, browser history and request logs; the page just renders again.
      <form method="post" onSubmit={startEnrolment} className="flex flex-col gap-4">
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
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "two-factor-setup-error" : undefined}
          />
        </div>
        {error && (
          <p id="two-factor-setup-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
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
      <form method="post" onSubmit={confirmEnrolment} className="flex flex-col gap-4">
        <h3 className="font-medium">3. Enter the 6-digit code from the app</h3>
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
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "two-factor-confirm-error" : undefined}
          />
        </div>
        {error && (
          <p id="two-factor-confirm-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          Verify and turn on
        </Button>
      </form>
    </div>
  );
}
