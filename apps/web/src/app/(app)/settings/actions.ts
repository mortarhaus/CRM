"use server";

import { HEX_COLOUR } from "@crm/core/branding";
import {
  ADDRESS_LINE_MAX_LENGTH,
  SETTINGS_TEXT_MAX_LENGTH,
  SHORT_CODE_MAX_LENGTH,
  SHORT_CODE_MIN_LENGTH,
} from "@crm/core/security";
import { SETTINGS_CURRENCIES } from "@crm/core/settings";
import { z } from "zod";
import {
  getSettings,
  StaleSettingsError,
  type SettingsPatch,
  updateSettings,
  type WorkspaceSettings,
} from "@/db/settings/workspace-settings";
import { ActionRefusedError, type ActionContext, action } from "@/lib/auth/action";
import { echoFields, expectedVersion, requiredText, taxAnswerFromForm, taxRate, text } from "@/lib/settings-input";

// Empty clears the code, as for text().
const shortCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^([A-Z0-9]{${SHORT_CODE_MIN_LENGTH},${SHORT_CODE_MAX_LENGTH}})?$`))
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

// Lower-cased before the check, and nothing but six hex digits passes (UNI-03): the value is later rendered into a
// CSS custom property (lib/brand.ts, which checks it again), and the column's CHECK refuses the same set.
const brandColour = z.string().trim().toLowerCase().regex(HEX_COLOUR);

// Every settings write waits for onboarding (PR #56 P3): until the Owner has chosen the country and answered the
// SST/GST question, an Admin could otherwise set the tax state that onboarding then leaves as it found it.
async function save(ctx: ActionContext, patch: SettingsPatch, version: number): Promise<{ before: WorkspaceSettings; after: WorkspaceSettings }> {
  const before = await getSettings(ctx.tx, { forUpdate: true });
  if (before.country === null) throw new ActionRefusedError("NOT_ONBOARDED");
  try {
    return { before, after: await updateSettings(ctx.tx, patch, version, ctx.userId) };
  } catch (error) {
    if (error instanceof StaleSettingsError) throw new ActionRefusedError("STALE_VERSION");
    throw error;
  }
}

// Branding is Admin and Owner (plan Q2, Charlie 2026-11-04). Only the colour in PR 2a; the logo comes with PR 4.
export const updateBrandingSettings = action({
  name: "settings.branding.update",
  minRole: "admin",
  input: z.strictObject({ expectedVersion, brandColour }),
  // The branding page's form (settings/branding), with or without JavaScript. A missing or non-numeric version gives
  // NaN or 0, which expectedVersion refuses.
  fromForm: (form) => ({ expectedVersion: Number(form.get("expectedVersion")), brandColour: form.get("brandColour") }),
  idempotent: false,
  handler: async (ctx, { expectedVersion: version, ...patch }) => ({ version: (await save(ctx, patch, version)).after.version }),
});

// Intl's own list (plan Task 9): what the runtime can format dates in. Empty or missing leaves the setting as it is.
const TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));
const timezone = z.string().refine((value) => TIME_ZONES.has(value)).optional();
// MYR and SGD until the money module (PR 7) brings ISO 4217 (MON-01).
const currency = z.enum(SETTINGS_CURRENCIES).optional();

const general = {
  expectedVersion,
  shortCode,
  addressLine1: text(ADDRESS_LINE_MAX_LENGTH),
  addressLine2: text(ADDRESS_LINE_MAX_LENGTH),
  addressCity: text(SETTINGS_TEXT_MAX_LENGTH),
  addressPostcode: text(SETTINGS_TEXT_MAX_LENGTH),
  addressState: text(SETTINGS_TEXT_MAX_LENGTH),
  timezone,
  baseCurrency: currency,
  defaultCurrency: currency,
  ownTin: text(SETTINGS_TEXT_MAX_LENGTH),
  ownBrn: text(SETTINGS_TEXT_MAX_LENGTH),
};

// The SST/GST answer is part of every save (spec line 732): a Yes requires the registration number, the tax name and
// the rate (CHECKs of 0026 and 0027); a No turns tax off and clears the default tax (0024), and keeps the number.
const generalInput = z.discriminatedUnion("taxRegistered", [
  z.strictObject({ ...general, taxRegistered: z.literal(false) }),
  z.strictObject({
    ...general,
    taxRegistered: z.literal(true),
    taxRegistrationNo: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    taxName: requiredText(SETTINGS_TEXT_MAX_LENGTH),
    taxRate,
  }),
]);

const GENERAL_TEXT_FIELDS = ["shortCode", "addressLine1", "addressLine2", "addressCity", "addressPostcode", "addressState", "ownTin", "ownBrn"] as const;
const GENERAL_CHOICES = ["timezone", "baseCurrency", "defaultCurrency"] as const;

// The general settings page's form, with or without JavaScript. An empty choice means "leave as it is".
function generalFromForm(form: FormData) {
  const fields: Record<string, unknown> = { expectedVersion: Number(form.get("expectedVersion")), ...taxAnswerFromForm(form) };
  for (const name of GENERAL_TEXT_FIELDS) fields[name] = form.get(name) ?? undefined;
  for (const name of GENERAL_CHOICES) fields[name] = form.get(name) || undefined;
  return fields;
}

// Changes that reach documents: a later change to these applies to new documents only (spec lines 460 and 731). No
// document exists before Phase 4, so the result only tells the page to say so.
const NEW_DOCUMENTS_ONLY = ["baseCurrency", "taxRegistered", "taxRegistrationNo", "defaultTaxName", "defaultTaxRateBps"] as const;

// The parsed form without its version, per answer (Omit over each member of the union).
type GeneralFields<T = z.infer<typeof generalInput>> = T extends unknown ? Omit<T, "expectedVersion"> : never;

function generalPatch(fields: GeneralFields): SettingsPatch {
  if (!fields.taxRegistered) return { ...fields, defaultTaxName: null, defaultTaxRateBps: null };
  const { taxName, taxRate: rateBps, ...rest } = fields;
  return { ...rest, defaultTaxName: taxName, defaultTaxRateBps: rateBps };
}

// General settings are Admin and Owner (plan Q9): the short code, the structured address (plan Q11, Q21), the
// timezone, the currencies, the SST/GST answer and the own TIN and BRN. Locale and date format: plan Q10 is answered (DECISIONS 2026-11-08); the editable date-format field is a follow-up PR.
export const updateGeneralSettings = action({
  name: "settings.general.update",
  minRole: "admin",
  input: generalInput,
  fromForm: generalFromForm,
  // Neither the address, the registration number, TIN nor BRN: personal data for a sole trader.
  echo: (form) => echoFields(form, ["shortCode", ...GENERAL_CHOICES, "taxName", "taxRate"]),
  idempotent: false,
  handler: async (ctx, { expectedVersion: version, ...fields }) => {
    const { before, after } = await save(ctx, generalPatch(fields), version);
    return { version: after.version, newDocumentsOnly: NEW_DOCUMENTS_ONLY.some((key) => before[key] !== after[key]) };
  },
});
