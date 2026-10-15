import type { Metadata } from "next";
import Link from "next/link";
import { TWO_FACTOR_EXPIRED } from "@/lib/auth/messages";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · CRM" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; expired?: string }>;
}) {
  const { registered, expired } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {registered === "1" && (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          If this email wasn&apos;t registered before, your account is ready. Sign in to continue.
        </p>
      )}
      {expired === "1" && (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          {TWO_FACTOR_EXPIRED}
        </p>
      )}
      <SignInForm />
      <p className="text-sm text-muted-foreground">
        New here?{" "}
        <Link className="underline underline-offset-4" href="/sign-up">
          Create an account
        </Link>
      </p>
    </>
  );
}
