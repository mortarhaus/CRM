"use server";

import { HEX_COLOUR } from "@crm/core/branding";
import {
  ADDRESS_LINE_MAX_LENGTH,
  characterCount,
  SETTINGS_TEXT_MAX_LENGTH,
  SHORT_CODE_MAX_LENGTH,
  SHORT_CODE_MIN_LENGTH,
} from "@crm/core/security";
import { z } from "zod";
import { StaleSettingsError, type SettingsPatch, updateSettings } from "@/db/settings/workspace-settings";
import { ActionRefusedError, type ActionContext, action } from "@/lib/auth/action";

// The version the form was rendered from (optimistic concurrency).
const expectedVersion = z.int().positive();

// Free text: trimmed, no control or format characters (a bidi override such as U+202E or a zero-width space would
// make a name or address on a document display reversed or differently from what is stored), at most `max` code
// points (as the CHECK counts); empty clears the field.
const text = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^[^\p{Cc}\p{Cf}]*$/u)
    .refine((value) => characterCount(value) <= max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

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

async function save(ctx: ActionContext, patch: SettingsPatch, version: number): Promise<{ version: number }> {
  try {
    return { version: (await updateSettings(ctx.tx, patch, version, ctx.userId)).version };
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
  handler: (ctx, { expectedVersion: version, ...patch }) => save(ctx, patch, version),
});

// General settings are Admin and Owner (plan Q9). The short code and the structured address only (plan Q11, Q21):
// country, timezone, locale, date format, currency and tax come with their validation sources in PR 3.
export const updateGeneralSettings = action({
  name: "settings.general.update",
  minRole: "admin",
  input: z.strictObject({
    expectedVersion,
    shortCode,
    addressLine1: text(ADDRESS_LINE_MAX_LENGTH),
    addressLine2: text(ADDRESS_LINE_MAX_LENGTH),
    addressCity: text(SETTINGS_TEXT_MAX_LENGTH),
    addressPostcode: text(SETTINGS_TEXT_MAX_LENGTH),
    addressState: text(SETTINGS_TEXT_MAX_LENGTH),
  }),
  idempotent: false,
  handler: (ctx, { expectedVersion: version, ...patch }) => save(ctx, patch, version),
});
