import { isSupportedCountry } from "@crm/core/settings";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StepUpPrompt } from "@/components/step-up-prompt";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import {
  PAYMENT_FORBIDDEN,
  PAYMENT_INTRO,
  PAYMENT_QR_GENERIC,
  PAYMENT_QR_NAMES,
  PAYMENT_QR_NONE,
  PAYMENT_TITLE,
  paymentQrAlt,
  STEP_UP_CONFIRMED,
  STEP_UP_ENROL,
  STEP_UP_ENROL_LINK,
} from "@/lib/auth/messages";
import { hasFreshStepUp } from "@/lib/auth/step-up";
import { paymentQrUrl } from "@/lib/uploads/payment-qr";
import { confirmStepUp, saveBankDetails, uploadPaymentQr } from "./actions";
import { BankDetailsForm } from "./bank-details-form";
import { PaymentQrForm } from "./payment-qr-form";

export const metadata: Metadata = { title: "Bank details · CRM" };

// Bank details and the payment QR are Owner only, with step-up (spec lines 788 and 798). This check is for the page;
// each action checks the role and step-up again (AUTH-02). A user without 2FA cannot step up, so they are sent to
// enrol (plan Q16).
async function loadPayment() {
  try {
    const member = await requireWorkspaceMember("owner");
    return await withWorkspace(member.workspaceId, async (tx) => ({
      settings: await getSettings(tx),
      steppedUp: await hasFreshStepUp(tx, { id: member.sessionId }),
      twoFactorEnabled: member.twoFactorEnabled,
    }));
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    if (error.status === "TWO_FACTOR_REQUIRED") redirect("/settings/security");
    return null;
  }
}

export default async function PaymentSettingsPage() {
  const payment = await loadPayment();
  if (!payment) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{PAYMENT_TITLE}</h1>
        <p className="text-sm">{PAYMENT_FORBIDDEN}</p>
      </>
    );
  }
  const { settings, steppedUp, twoFactorEnabled } = payment;
  const qrName = settings.country && isSupportedCountry(settings.country) ? PAYMENT_QR_NAMES[settings.country] : PAYMENT_QR_GENERIC;

  return (
    <>
      <h1 className="text-2xl font-semibold">{PAYMENT_TITLE}</h1>
      <div className="flex max-w-2xl flex-col gap-6">
        <p className="text-sm text-muted-foreground">{PAYMENT_INTRO}</p>
        {!twoFactorEnabled ? (
          <p className="text-sm">
            {STEP_UP_ENROL}{" "}
            <Link href="/settings/security" className="underline underline-offset-4">
              {STEP_UP_ENROL_LINK}
            </Link>
          </p>
        ) : (
          <>
            {steppedUp ? (
              <p role="status" className="text-sm">
                {STEP_UP_CONFIRMED}
              </p>
            ) : (
              <StepUpPrompt action={confirmStepUp} />
            )}
            <BankDetailsForm
              action={saveBankDetails}
              version={settings.version}
              saved={{
                bankName: settings.bankName,
                bankAccountHolder: settings.bankAccountHolder,
                bankAccountNumber: settings.bankAccountNumber,
                bankSwiftCode: settings.bankSwiftCode,
              }}
              steppedUp={steppedUp}
            />
            <section aria-labelledby="qr-heading" className="flex flex-col gap-4 border-t border-border pt-6">
              <h2 id="qr-heading" className="text-lg font-semibold">
                {qrName}
              </h2>
              {settings.duitnowQrKey ? (
                // Same-origin route (files/payment-qr), so img-src 'self' covers it. Any shape is accepted (Charlie
                // 2026-11-23): the frame fits the image's own proportions, at most 160 px high and the column wide. The
                // slot's fixed height keeps the content below in place while the image loads (no layout shift).
                <div className="flex h-40 items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private, session-bound image: next/image's optimiser would fetch it without the session. */}
                  <img
                    src={paymentQrUrl(settings.duitnowQrKey)}
                    alt={paymentQrAlt(qrName)}
                    className="h-auto max-h-full w-auto max-w-full rounded-md border border-border bg-card p-2"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{PAYMENT_QR_NONE}</p>
              )}
              <PaymentQrForm action={uploadPaymentQr} version={settings.version} name={qrName} steppedUp={steppedUp} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
