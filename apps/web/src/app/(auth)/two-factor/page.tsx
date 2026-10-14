import type { Metadata } from "next";
import { TwoFactorForms } from "./two-factor-forms";

export const metadata: Metadata = { title: "Two-factor verification · CRM" };

export default function TwoFactorPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Two-factor verification</h1>
      <TwoFactorForms />
    </>
  );
}
