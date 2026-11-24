"use server";

import { PeriodBehindError, parsePatternFor, RESET_RULES } from "@crm/core/numbering";
import { isSupportedCountry } from "@crm/core/settings";
import { z } from "zod";
import { ensureInvoiceSequence, StaleSequenceError, updateSequence } from "@/db/numbering/sequence";
import { getSettings } from "@/db/settings/workspace-settings";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { echoFields, expectedVersion } from "@/lib/settings-input";

// The pattern and the rule are checked together (UNI-03): only the five tokens and free text, one {SEQ:n}, and the
// period a yearly or monthly reset needs. The field named on a refusal is the pattern.
const input = z
  .strictObject({ expectedVersion, pattern: z.string().trim(), resetRule: z.enum(RESET_RULES) })
  .superRefine((value, context) => {
    if (!parsePatternFor(value.pattern, value.resetRule).ok) context.addIssue({ code: "custom", path: ["pattern"], message: "refused" });
  });

// Numbering is Admin and Owner (spec line 792). The invoice counter only in Phase 2 (plan Q20). A change applies to new
// documents only (spec "Numbering"); it is audited as doc_sequence.updated. A workspace onboarded before the counter
// existed gets it here first, from its country's defaults.
export const updateNumberingSettings = action({
  name: "settings.numbering.update",
  minRole: "admin",
  input,
  fromForm: (form) => ({
    expectedVersion: Number(form.get("expectedVersion")),
    pattern: form.get("pattern"),
    resetRule: form.get("resetRule"),
  }),
  // Neither is personal data or a secret.
  echo: (form) => echoFields(form, ["pattern", "resetRule"]),
  idempotent: false,
  handler: async (ctx, { expectedVersion: version, pattern, resetRule }) => {
    const settings = await getSettings(ctx.tx);
    if (settings.country === null || !isSupportedCountry(settings.country) || settings.timezone === null) {
      throw new ActionRefusedError("NOT_ONBOARDED");
    }
    await ensureInvoiceSequence(ctx.tx, settings.country, ctx.userId);
    try {
      const updated = await updateSequence(ctx.tx, "invoice", { pattern, resetRule }, version, ctx.userId, settings.timezone);
      return { version: updated.version };
    } catch (error) {
      if (error instanceof StaleSequenceError) throw new ActionRefusedError("STALE_VERSION");
      // A reset-rule change while the workspace time zone is still before the last number's period (DECISIONS
      // 2026-11-24): refused rather than a counter reset that could repeat numbers.
      if (error instanceof PeriodBehindError) throw new ActionRefusedError("PERIOD_BEHIND");
      throw error;
    }
  },
});
