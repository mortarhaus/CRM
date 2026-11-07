import { bpsToPercent, COUNTRY_DEFAULTS, isSupportedCountry, SETTINGS_CURRENCIES } from "@crm/core/settings";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings, type WorkspaceSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { COUNTRY_NAMES, GENERAL_FORBIDDEN, GENERAL_INTRO, GENERAL_TITLE, SETUP_PENDING, TAX_SCHEMES } from "@/lib/auth/messages";
import { updateGeneralSettings } from "../actions";
import { GeneralForm, type GeneralValues } from "./general-form";

export const metadata: Metadata = { title: "General settings · CRM" };

// Admin and Owner (plan Q9). Staff see the refusal instead of the form; the action checks the role again on every
// post (AUTH-02). The app layout shows this page only once the workspace is onboarded (it has a country).
async function loadSettings(): Promise<WorkspaceSettings | null> {
  try {
    const { workspaceId } = await requireWorkspaceMember("admin");
    return await withWorkspace(workspaceId, (tx) => getSettings(tx));
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    return null;
  }
}

// The stored values as the form shows them. A tax not yet set up is preselected from the country's defaults for a
// Yes (spec line 732), as in onboarding.
function formValues(settings: WorkspaceSettings): GeneralValues | null {
  const country = settings.country;
  if (country === null || !isSupportedCountry(country)) return null;
  const defaults = COUNTRY_DEFAULTS[country];
  const optional = (value: string | null) => value ?? undefined;
  return {
    version: settings.version,
    countryName: COUNTRY_NAMES[country],
    scheme: TAX_SCHEMES[country],
    shortCode: optional(settings.shortCode),
    addressLine1: optional(settings.addressLine1),
    addressLine2: optional(settings.addressLine2),
    addressCity: optional(settings.addressCity),
    addressPostcode: optional(settings.addressPostcode),
    addressState: optional(settings.addressState),
    timezone: optional(settings.timezone),
    baseCurrency: optional(settings.baseCurrency),
    defaultCurrency: optional(settings.defaultCurrency),
    taxRegistered: settings.taxRegistered,
    taxRegistrationNo: optional(settings.taxRegistrationNo),
    taxName: settings.defaultTaxName ?? defaults.taxName,
    taxRate: bpsToPercent(settings.defaultTaxRateBps ?? defaults.taxRateBps),
    ownTin: optional(settings.ownTin),
    ownBrn: optional(settings.ownBrn),
  };
}

export default async function GeneralSettingsPage() {
  const settings = await loadSettings();
  const values = settings && formValues(settings);

  return (
    <>
      <h1 className="text-2xl font-semibold">{GENERAL_TITLE}</h1>
      <div className="flex max-w-2xl flex-col gap-4">
        {settings === null ? (
          <p className="text-sm">{GENERAL_FORBIDDEN}</p>
        ) : values === null ? (
          <p className="text-sm">{SETUP_PENDING}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{GENERAL_INTRO}</p>
            <GeneralForm
              action={updateGeneralSettings}
              values={values}
              timeZones={Intl.supportedValuesOf("timeZone")}
              currencies={SETTINGS_CURRENCIES}
            />
          </>
        )}
      </div>
    </>
  );
}
