import { isSupportedCountry } from "@crm/core/settings";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StepUpPrompt } from "@/components/step-up-prompt";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import {
  BANK_ACCOUNT_HOLDER,
  BANK_ACCOUNT_NUMBER,
  BANK_NAME,
  BANK_SWIFT_CODE,
  NOT_SET,
  PAYMENT_CHANGE_FORBIDDEN,
  PAYMENT_FORBIDDEN,
  PAYMENT_INTRO,
  PAYMENT_QR_GENERIC,
  PAYMENT_QR_NAMES,
  PAYMENT_QR_NONE,
  PAYMENT_TITLE,
  PAYMENT_VIEW_ENROL,
  paymentQrAlt,
  STEP_UP_CONFIRMED,
  STEP_UP_ENROL,
  STEP_UP_ENROL_LINK,
} from "@/lib/auth/messages";
import { hasFreshStepUp } from "@/lib/auth/step-up";
import { cn } from "@/lib/utils";
import { paymentQrUrl } from "@/lib/uploads/payment-qr";
import { confirmStepUp, saveBankDetails, uploadPaymentQr } from "./actions";
import { type BankDetails, BankDetailsForm } from "./bank-details-form";
import { PaymentQrForm } from "./payment-qr-form";

export const metadata: Metadata = { title: "Bank details · CRM" };

// Changing the bank details and the payment QR is Owner only, with step-up; an Admin may view them, with no step-up
// (spec "Authorization", revision 13). This check is for the page; each action checks the role and step-up again
// (AUTH-02). Without 2FA nobody sees the values, whatever require_2fa says: an Owner cannot step up, and an Admin
// must have 2FA on to view; both are sent to enrol (plan Q16).
async function loadPayment() {
  try {
    const member = await requireWorkspaceMember("admin");
    const isOwner = member.role === "owner";
    return await withWorkspace(member.workspaceId, async (tx) => ({
      settings: await getSettings(tx),
      isOwner,
      steppedUp: isOwner && (await hasFreshStepUp(tx, { id: member.sessionId })),
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

const BANK_FIELDS = [
  { name: "bankName", label: BANK_NAME },
  { name: "bankAccountHolder", label: BANK_ACCOUNT_HOLDER },
  { name: "bankAccountNumber", label: BANK_ACCOUNT_NUMBER },
  { name: "bankSwiftCode", label: BANK_SWIFT_CODE },
] as const;

// The Admin's view: the saved values, no form and no step-up prompt.
function BankDetailsList({ saved }: { saved: BankDetails }) {
  return (
    <dl className="flex max-w-sm flex-col gap-4">
      {BANK_FIELDS.map((field) => (
        <div key={field.name} className="flex flex-col gap-1">
          <dt className="text-sm font-medium">{field.label}</dt>
          <dd className={cn("break-words text-sm", saved[field.name] === null && "text-muted-foreground")}>
            {saved[field.name] ?? NOT_SET}
          </dd>
        </div>
      ))}
    </dl>
  );
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
  const { settings, isOwner, steppedUp, twoFactorEnabled } = payment;
  const saved: BankDetails = {
    bankName: settings.bankName,
    bankAccountHolder: settings.bankAccountHolder,
    bankAccountNumber: settings.bankAccountNumber,
    bankSwiftCode: settings.bankSwiftCode,
  };
  const qrName = settings.country && isSupportedCountry(settings.country) ? PAYMENT_QR_NAMES[settings.country] : PAYMENT_QR_GENERIC;

  return (
    <>
      <h1 className="text-2xl font-semibold">{PAYMENT_TITLE}</h1>
      <div className="flex max-w-2xl flex-col gap-6">
        <p className="text-sm text-muted-foreground">{PAYMENT_INTRO}</p>
        {!twoFactorEnabled ? (
          <p className="text-sm">
            {isOwner ? STEP_UP_ENROL : PAYMENT_VIEW_ENROL}{" "}
            <Link href="/settings/security" className="underline underline-offset-4">
              {STEP_UP_ENROL_LINK}
            </Link>
          </p>
        ) : (
          <>
            {!isOwner ? (
              <p className="text-sm">{PAYMENT_CHANGE_FORBIDDEN}</p>
            ) : steppedUp ? (
              <p role="status" className="text-sm">
                {STEP_UP_CONFIRMED}
              </p>
            ) : (
              <StepUpPrompt key={`step-up:${settings.workspaceId}`} action={confirmStepUp} workspaceId={settings.workspaceId} />
            )}
            {/* Keyed by workspace (as every bound form): a workspace switch starts fresh forms, never ones holding
                another workspace's values. Sibling keys differ, or the prompt's return would remount this form. */}
            {isOwner ? (
              <BankDetailsForm
                key={`bank:${settings.workspaceId}`}
                action={saveBankDetails}
                workspaceId={settings.workspaceId}
                version={settings.version}
                saved={saved}
                steppedUp={steppedUp}
              />
            ) : (
              <BankDetailsList saved={saved} />
            )}
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
              {isOwner && (
                <PaymentQrForm
                  key={settings.workspaceId}
                  action={uploadPaymentQr}
                  version={settings.version}
                  name={qrName}
                  steppedUp={steppedUp}
                  workspaceId={settings.workspaceId}
                />
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
