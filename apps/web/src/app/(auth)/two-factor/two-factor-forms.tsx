"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { TOO_MANY_ATTEMPTS, WRONG_CODE } from "@/lib/auth/messages";

export function TwoFactorForms() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finish(result: Promise<{ error: { status: number } | null }>, wrongMessage: string) {
    setPending(true);
    setError(null);
    const { error: verifyError } = await result;
    setPending(false);
    if (verifyError) {
      setError(verifyError.status === 429 ? TOO_MANY_ATTEMPTS : wrongMessage);
      return;
    }
    router.push("/workspaces");
    router.refresh();
  }

  function submitAuthenticatorCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    void finish(authClient.twoFactor.verifyTotp({ code, trustDevice: false }), WRONG_CODE);
  }

  function submitRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("recovery-code") ?? "").trim();
    void finish(
      authClient.twoFactor.verifyBackupCode({ code }),
      "That recovery code didn't work. Check it and try again.",
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p id="two-factor-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <section aria-labelledby="authenticator-heading" className="flex flex-col gap-4">
        <h2 id="authenticator-heading" className="text-lg font-semibold">
          Authenticator app
        </h2>
        <form onSubmit={submitAuthenticatorCode} className="flex flex-col gap-4">
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
              aria-describedby={error ? "two-factor-error" : undefined}
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
        <form onSubmit={submitRecoveryCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="recovery-code">Recovery code</Label>
            <Input
              id="recovery-code"
              name="recovery-code"
              type="text"
              autoComplete="off"
              required
              aria-describedby={error ? "two-factor-error" : undefined}
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
