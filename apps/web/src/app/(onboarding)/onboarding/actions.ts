"use server";

import { SETTINGS_TEXT_MAX_LENGTH } from "@crm/core/security";
import { SUPPORTED_COUNTRIES } from "@crm/core/settings";
import { z } from "zod";
import { AlreadyOnboardedError, applyCountryDefaults } from "@/db/settings/apply-country-defaults";
import { StaleSettingsError } from "@/db/settings/workspace-settings";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { echoFields, expectedVersion, requiredText, shortCode, taxAnswerFromForm, taxRate, text } from "@/lib/settings-input";

const common = {
  expectedVersion,
  country: z.enum(SUPPORTED_COUNTRIES),
  // Optional, as in General settings (Charlie 2026-11-24): empty or missing skips it and leaves the code unset.
  shortCode,
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

// The onboarding form (plan Task 8), with or without JavaScript.
function fromForm(form: FormData) {
  return {
    expectedVersion: Number(form.get("expectedVersion")),
    country: form.get("country"),
    shortCode: form.get("shortCode") ?? undefined,
    ownTin: form.get("ownTin") ?? undefined,
    ownBrn: form.get("ownBrn") ?? undefined,
    ...taxAnswerFromForm(form),
  };
}

// A refused form shows the short code, the answer and the tax name and rate again; the registration number, TIN and BRN
// are typed again (personal data for a sole trader, as in the audit redaction).
const echo = (form: FormData) => echoFields(form, ["shortCode", "taxName", "taxRate"]);

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
  handler: async (ctx, { expectedVersion: version, country, shortCode: code, ownTin, ownBrn, ...answer }) => {
    const tax = answer.taxRegistered
      ? { registered: true as const, registrationNo: answer.taxRegistrationNo, taxName: answer.taxName, taxRateBps: answer.taxRate }
      : { registered: false as const };
    try {
      const updated = await applyCountryDefaults(
        ctx.tx,
        { country, tax, ownTin: ownTin ?? null, ownBrn: ownBrn ?? null, shortCode: code ?? null },
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
