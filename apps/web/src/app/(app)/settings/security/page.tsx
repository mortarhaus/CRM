import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { TwoFactorSetup } from "./two-factor-setup";

export const metadata: Metadata = { title: "Security · CRM" };

export default async function SecurityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  return (
    <>
      <h1 className="text-2xl font-semibold">Security</h1>
      <section aria-labelledby="two-factor-heading" className="flex max-w-xl flex-col gap-4">
        <h2 id="two-factor-heading" className="text-lg font-semibold">
          Two-factor authentication
        </h2>
        <TwoFactorSetup initiallyEnabled={session.user.twoFactorEnabled === true} />
      </section>
    </>
  );
}
