"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

const SIGN_OUT_FAILED = "We couldn't sign you out. Try again.";

async function signOutOnServer(): Promise<boolean> {
  try {
    const { error } = await authClient.signOut();
    return !error;
  } catch {
    return false;
  }
}

export function SignOutButton() {
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    if (await signOutOnServer()) {
      router.push("/sign-in");
      router.refresh();
      return;
    }
    setPending(false);
    setError(SIGN_OUT_FAILED);
    // Disabling the button while pending dropped its focus; put it back so a keyboard user can retry.
    requestAnimationFrame(() => button.current?.focus());
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Button
        ref={button}
        variant="outline"
        onClick={onClick}
        disabled={pending}
        aria-describedby={error ? "sign-out-error" : undefined}
      >
        Sign out
      </Button>
      {error && (
        <p id="sign-out-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
