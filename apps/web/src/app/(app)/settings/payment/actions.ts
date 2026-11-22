"use server";

import { PAYMENT_QR_MAX_BYTES, SETTINGS_TEXT_MAX_LENGTH } from "@crm/core/security";
import { z } from "zod";
import { getStorage } from "@/adapters/storage";
import { notifyUsers } from "@/db/settings/notifications";
import { getSettings, type SettingsPatch, updateSettings } from "@/db/settings/workspace-settings";
import { listOwnerIds } from "@/db/system";
import { ActionRefusedError, type ActionContext, action } from "@/lib/auth/action";
import { requireStepUp, STEP_UP_ACTION } from "@/lib/auth/step-up";
import { expectedVersion, requiredText } from "@/lib/settings-input";
import { PAYMENT_QR_TYPES, paymentQrKey } from "@/lib/uploads/payment-qr";
import { validateUpload } from "@/lib/uploads/validate";

// Bank details and the payment QR are Owner only, with step-up (spec lines 788 and 798; plan Task 14). Each change
// is audited (the account number as its last 4 characters, the QR as its key), stamps bank_details_changed_at and
// gives every Owner an in-app notification, all in the one transaction (plan Task 15). The owner email is PR 5c.

// The step-up prompt of this page: verifyStepUp (lib/auth/step-up.ts), with the code read from the form.
export const confirmStepUp = action({ ...STEP_UP_ACTION, fromForm: (form) => ({ code: form.get("code") }) });

const REFUSAL = { EMPTY: "UPLOAD_EMPTY", TOO_LARGE: "UPLOAD_TOO_LARGE", TYPE_NOT_ALLOWED: "UPLOAD_TYPE_NOT_ALLOWED" } as const;

// In order: step-up first, so nothing is read or stored without it; onboarding and the version; the patch (for the QR,
// where the file is checked and stored); then, only if a value differs, the update and the Owners' notifications.
async function changePaymentDetails(
  ctx: ActionContext,
  version: number,
  makePatch: () => Promise<SettingsPatch>,
): Promise<{ version: number }> {
  await requireStepUp(ctx.tx, { id: ctx.sessionId });
  const before = await getSettings(ctx.tx, { forUpdate: true });
  if (before.country === null) throw new ActionRefusedError("NOT_ONBOARDED");
  if (before.version !== version) throw new ActionRefusedError("STALE_VERSION");
  const patch = await makePatch();
  const keys = Object.keys(patch) as (keyof SettingsPatch)[];
  if (keys.every((key) => patch[key] === before[key])) return { version };
  const after = await updateSettings(
    ctx.tx,
    { ...patch, bankDetailsChangedAt: new Date() },
    version,
    ctx.userId,
    "workspace_settings.bank_details_updated",
  );
  await notifyUsers(ctx.tx, await listOwnerIds(ctx.tx, ctx.workspaceId), {
    kind: "bank_details_changed",
    targetType: "workspace_settings",
    targetId: ctx.workspaceId,
  });
  return { version: after.version };
}

// ISO 9362, as the column's CHECK: 8 or 11 characters. Empty clears it.
const swiftCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^([A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?)?$/)
  .transform((value) => (value === "" ? null : value));

// Plan Q17 (Charlie 2026-11-22): bank name, account holder name and account number are required; SWIFT is optional.
export const saveBankDetails = action({
  name: "settings.payment.bank",
  minRole: "owner",
  input: z.strictObject({
    expectedVersion,
    bankName: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    bankAccountHolder: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    bankAccountNumber: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    bankSwiftCode: swiftCode,
  }),
  fromForm: (form) => ({
    expectedVersion: Number(form.get("expectedVersion")),
    bankName: form.get("bankName"),
    bankAccountHolder: form.get("bankAccountHolder"),
    bankAccountNumber: form.get("bankAccountNumber"),
    bankSwiftCode: form.get("bankSwiftCode") ?? "",
  }),
  idempotent: false,
  handler: async (ctx, { expectedVersion: version, ...patch }) => changePaymentDetails(ctx, version, async () => patch),
});

// The QR: storage configured and the declared size (so an oversize file is never read); then step-up, onboarding and
// the version; the bytes by magic number (FILE-01, FILE-02); the put under the content key, conditional, where an
// existing object (the same image) counts as stored; then the key. No delete exists: a replaced QR stays in storage
// (spec line 847).
export const uploadPaymentQr = action({
  name: "settings.payment.qr",
  minRole: "owner",
  input: z.strictObject({ expectedVersion, qr: z.instanceof(File) }),
  fromForm: (form) => ({ expectedVersion: Number(form.get("expectedVersion")), qr: form.get("qr") }),
  idempotent: false,
  handler: async (ctx, { expectedVersion: version, qr }) => {
    const storage = getStorage();
    if (!storage) throw new ActionRefusedError("STORAGE_UNAVAILABLE");
    if (qr.size === 0) throw new ActionRefusedError("UPLOAD_EMPTY");
    if (qr.size > PAYMENT_QR_MAX_BYTES) throw new ActionRefusedError("UPLOAD_TOO_LARGE");
    return changePaymentDetails(ctx, version, async () => {
      const bytes = new Uint8Array(await qr.arrayBuffer());
      const checked = validateUpload(bytes, { allowed: PAYMENT_QR_TYPES, maxBytes: PAYMENT_QR_MAX_BYTES });
      if (!checked.ok) throw new ActionRefusedError(REFUSAL[checked.reason]);
      const key = paymentQrKey(ctx.workspaceId, bytes, checked.type);
      await storage.put(key, bytes, checked.contentType, { ifNoneMatch: true });
      return { duitnowQrKey: key };
    });
  },
});
