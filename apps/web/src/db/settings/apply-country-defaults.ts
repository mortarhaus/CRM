import { COUNTRY_DEFAULTS, type Country } from "@crm/core/settings";
import type { Tx } from "../workspace";
import { getSettings, type SettingsPatch, updateSettings, type WorkspaceSettings } from "./workspace-settings";

// The SST/GST answer (spec line 732): No leaves tax off; Yes carries the registration number and the tax name and
// rate the owner kept or edited (preselected from the country defaults).
export type TaxAnswer =
  | { registered: false }
  | { registered: true; registrationNo: string; taxName: string; taxRateBps: number };

export interface OnboardingAnswer {
  country: Country;
  tax: TaxAnswer;
  ownTin: string | null;
  ownBrn: string | null;
}

export class AlreadyOnboardedError extends Error {
  constructor() {
    super("workspace already has a country");
    this.name = "AlreadyOnboardedError";
  }
}

// Onboarding (Phase 2 plan Task 8): runs once, while the workspace has no country, in the caller's withWorkspace
// transaction (action(), Owner). Each value fills only a field that is still empty, so an existing setting is never
// overwritten, and a country default that is unresolved (null) is not written at all. Versioned and audited
// through updateSettings.
export async function applyCountryDefaults(
  tx: Tx,
  answer: OnboardingAnswer,
  expectedVersion: number,
  actorUserId: string,
): Promise<WorkspaceSettings> {
  const current = await getSettings(tx, { forUpdate: true });
  if (current.country !== null) throw new AlreadyOnboardedError();
  const defaults = COUNTRY_DEFAULTS[answer.country];
  const patch: SettingsPatch = { country: answer.country };
  const fill = <K extends keyof SettingsPatch>(key: K, value: WorkspaceSettings[K] | null) => {
    if (current[key] === null && value !== null) patch[key] = value;
  };

  fill("timezone", defaults.timezone);
  fill("dateFormat", defaults.dateFormat);
  fill("locale", defaults.locale);
  fill("baseCurrency", defaults.currency);
  fill("defaultCurrency", defaults.currency);
  fill("ownTin", answer.ownTin);
  fill("ownBrn", answer.ownBrn);
  if (answer.tax.registered && !current.taxRegistered) {
    patch.taxRegistered = true;
    fill("taxRegistrationNo", answer.tax.registrationNo);
    fill("defaultTaxName", answer.tax.taxName);
    fill("defaultTaxRateBps", answer.tax.taxRateBps);
  }
  return updateSettings(tx, patch, expectedVersion, actorUserId, "workspace_settings.onboarded");
}
