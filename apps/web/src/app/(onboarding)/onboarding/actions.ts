"use server";

import { SETTINGS_TEXT_MAX_LENGTH } from "@crm/core/security";
import { percentToBps, SUPPORTED_COUNTRIES } from "@crm/core/settings";
import { z } from "zod";
import { AlreadyOnboardedError, applyCountryDefaults } from "@/db/settings/apply-country-defaults";
import { StaleSettingsError } from "@/db/settings/workspace-settings";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { expectedVersion, requiredText, text } from "@/lib/settings-input";

// Typed as a percentage, stored in basis points; never below 0 (spec line 460).
const taxRate = z.string().transform((value, context) => {
  const bps = percentToBps(value);
  if (bps === null) {
    context.addIssue({ code: "custom", message: "not a percentage" });
    return z.NEVER;
  }
  return bps;
});

const common = {
  expectedVersion,
  country: z.enum(SUPPORTED_COUNTRIES),
  ownTin: text(SETTINGS_TEXT_MAX_LENGTH),
  ownBrn: text(SETTINGS_TEXT_MAX_LENGTH),
};

// A Yes requires the registration number, as the CHECK of migration 0026 does (spec line 732).
const input = z.discriminatedUnion("taxRegistered", [
  z.strictObject({ ...common, taxRegistered: z.literal(false) }),
  z.strictObject({
    ...common,
    taxRegistered: z.literal(true),
    taxRegistrationNo: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    taxName: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    taxRate,
  }),
]);

const YES_NO: Record<string, boolean> = { yes: true, no: false };

// The onboarding form (plan Task 8), with or without JavaScript. The tax fields are posted with a No as well (they are
// only hidden), so they are read only for a Yes.
function fromForm(form: FormData) {
  const answer = form.get("taxRegistered");
  const registered = typeof answer === "string" && Object.hasOwn(YES_NO, answer) ? YES_NO[answer] : answer;
  return {
    expectedVersion: Number(form.get("expectedVersion")),
    country: form.get("country"),
    taxRegistered: registered,
    ownTin: form.get("ownTin") ?? undefined,
    ownBrn: form.get("ownBrn") ?? undefined,
    ...(registered === true && {
      taxRegistrationNo: form.get("taxRegistrationNo"),
      taxName: form.get("taxName"),
      taxRate: form.get("taxRate"),
    }),
  };
}

// What a refused form shows again (PR #56 R1): the Yes or No, and the tax name and rate, which are neither secret nor
// personal data. The registration number, TIN and BRN are not sent back (personal data for a sole trader, as in the
// audit redaction); without JavaScript the Owner types them again.
function echo(form: FormData): Record<string, string> {
  const shown: Record<string, string> = {};
  const answer = form.get("taxRegistered");
  if (answer === "yes" || answer === "no") shown.taxRegistered = answer;
  for (const name of ["taxName", "taxRate"]) {
    const value = form.get(name);
    if (typeof value === "string") shown[name] = value;
  }
  return shown;
}

// The workspace's country and SST/GST answer, once, by its Owner (plan Q9). A workspace that already has a country is
// refused as STALE_VERSION: the page it was posted from is out of date. Done, the Owner goes on to the app ("/"), by a
// redirect from the action so that a post without JavaScript ends there too (see redirectTo in action()).
export const completeOnboarding = action({
  name: "settings.onboarding.complete",
  minRole: "owner",
  input,
  fromForm,
  echo,
  idempotent: false,
  redirectTo: "/",
  handler: async (ctx, { expectedVersion: version, country, ownTin, ownBrn, ...answer }) => {
    const tax = answer.taxRegistered
      ? { registered: true as const, registrationNo: answer.taxRegistrationNo, taxName: answer.taxName, taxRateBps: answer.taxRate }
      : { registered: false as const };
    try {
      const updated = await applyCountryDefaults(
        ctx.tx,
        { country, tax, ownTin: ownTin ?? null, ownBrn: ownBrn ?? null },
        version,
        ctx.userId,
      );
      return { version: updated.version };
    } catch (error) {
      if (error instanceof StaleSettingsError || error instanceof AlreadyOnboardedError) throw new ActionRefusedError("STALE_VERSION");
      throw error;
    }
  },
});
