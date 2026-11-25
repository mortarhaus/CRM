import { characterCount, SHORT_CODE_MAX_LENGTH, SHORT_CODE_MIN_LENGTH } from "@crm/core/security";
import { percentToBps } from "@crm/core/settings";
import { z } from "zod";

// Zod pieces shared by the settings and onboarding actions (UNI-03).

// The version the form was rendered from (optimistic concurrency).
export const expectedVersion = z.int().positive();

// Free text: trimmed, no control or format characters (a bidi override such as U+202E or a zero-width space would
// make a name or address on a document display reversed or differently from what is stored), at most `max` code
// points (as the CHECK counts); empty clears the field.
export const text = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^[^\p{Cc}\p{Cf}]*$/u)
    .refine((value) => characterCount(value) <= max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

// The workspace short code ({CODE} in document numbers; plan Q21): upper-cased, 2 to 6 letters or digits, as the
// CHECK of migration 0024. Empty clears it in General settings and skips it at onboarding, as for text().
export const shortCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^([A-Z0-9]{${SHORT_CODE_MIN_LENGTH},${SHORT_CODE_MAX_LENGTH}})?$`))
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

// Text over several lines: line breaks kept (as \n), otherwise as text() (trimmed, no other control or format
// character, at most `max` code points). Empty stays "".
export const multilineText = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\r\n?/g, "\n").trim())
    .pipe(z.string().regex(/^(?:\n|[^\p{Cc}\p{Cf}])*$/u))
    .refine((value) => characterCount(value) <= max);

// As text(), but a value is required: empty, missing or null is refused.
export const requiredText = (max: number) => text(max).pipe(z.string());

// Typed as a percentage, stored in basis points; never below 0 (spec line 460).
export const taxRate = z.string().transform((value, context) => {
  const bps = percentToBps(value);
  if (bps === null) {
    context.addIssue({ code: "custom", message: "not a percentage" });
    return z.NEVER;
  }
  return bps;
});

const YES_NO: Record<string, boolean> = { yes: true, no: false };

// The SST/GST answer of a posted form (onboarding, general settings). The tax fields are posted with a No as well
// (they are only hidden), so they are read only for a Yes.
export function taxAnswerFromForm(form: FormData) {
  const answer = form.get("taxRegistered");
  const registered = typeof answer === "string" && Object.hasOwn(YES_NO, answer) ? YES_NO[answer] : answer;
  return {
    taxRegistered: registered,
    ...(registered === true && {
      taxRegistrationNo: form.get("taxRegistrationNo"),
      taxName: form.get("taxName"),
      taxRate: form.get("taxRate"),
    }),
  };
}

// What a refused form shows again (action() echo, PR #56 R1): the Yes or No, and the named fields as posted. Name only
// fields that are neither secret nor personal data: never the registration number, TIN, BRN or an address.
export function echoFields(form: FormData, names: readonly string[]): Record<string, string> {
  const shown: Record<string, string> = {};
  const answer = form.get("taxRegistered");
  if (answer === "yes" || answer === "no") shown.taxRegistered = answer;
  for (const name of names) {
    const value = form.get(name);
    if (typeof value === "string") shown[name] = value;
  }
  return shown;
}
