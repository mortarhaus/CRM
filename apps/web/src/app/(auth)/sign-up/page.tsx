import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account · CRM" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="underline underline-offset-4" href="/sign-in">
          Sign in
        </Link>
      </p>
    </>
  );
}
