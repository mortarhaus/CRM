export const PII_REDACTED = "[pii]";

// Audit entries keep no personal data (spec "Audit, logging, privacy"): every listed field that is present becomes
// PII_REDACTED, whatever its value. Nested objects are not walked; callers pass flat before/after shapes.
export function redactPii<T extends Record<string, unknown>>(
  value: T | null,
  piiFields: readonly (keyof T)[],
): Record<string, unknown> | null {
  if (value === null) return null;
  const redacted: Record<string, unknown> = { ...value };
  for (const field of piiFields) {
    if (Object.hasOwn(redacted, field)) redacted[field as string] = PII_REDACTED;
  }
  return redacted;
}
