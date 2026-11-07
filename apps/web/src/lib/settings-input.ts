import { characterCount } from "@crm/core/security";
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

// As text(), but a value is required: empty, missing or null is refused.
export const requiredText = (max: number) => text(max).pipe(z.string());
