import { bpsToPercent, COUNTRY_DEFAULTS, type Country, isSupportedCountry, SUPPORTED_COUNTRIES } from "@crm/core/settings";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Radio } from "@/components/ui/radio";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { COUNTRY_NAMES, ONBOARDING_CONTINUE, ONBOARDING_COUNTRY_LEGEND, ONBOARDING_TITLE } from "@/lib/auth/messages";
import { completeOnboarding } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your workspace · CRM" };

// The Owner of the active workspace, while it has no country (plan Task 8). Anyone else, or a workspace already set up,
// goes back to the app, whose layout shows Admin and Staff that setup is not finished. The action checks all of this
// again on every post (AUTH-02). action() heals a missing settings row on the way (requireWorkspaceMember).
async function loadVersion(): Promise<{ version: number; workspaceId: string } | null> {
  try {
    const { workspaceId } = await requireWorkspaceMember("owner");
    const settings = await withWorkspace(workspaceId, (tx) => getSettings(tx));
    return settings.country === null ? { version: settings.version, workspaceId } : null;
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    return null;
  }
}

// Step 1 is a plain GET form, so the country (and the tax defaults it preselects in step 2) needs no JavaScript.
function CountryStep() {
  return (
    <form method="get" className="flex max-w-md flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">{ONBOARDING_COUNTRY_LEGEND}</legend>
        {SUPPORTED_COUNTRIES.map((country) => (
          <div key={country} className="flex min-h-10 items-center gap-3">
            <Radio id={`country-${country}`} name="country" value={country} required />
            <Label htmlFor={`country-${country}`}>{COUNTRY_NAMES[country]}</Label>
          </div>
        ))}
      </fieldset>
      <Button type="submit" className="self-start">
        {ONBOARDING_CONTINUE}
      </Button>
    </form>
  );
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ country?: string | string[] }> }) {
  const loaded = await loadVersion();
  if (loaded === null) redirect("/");
  const requested = (await searchParams).country;
  const country: Country | null = typeof requested === "string" && isSupportedCountry(requested) ? requested : null;

  return (
    <>
      <h1 className="text-2xl font-semibold">{ONBOARDING_TITLE}</h1>
      {country ? (
        <OnboardingForm
          key={loaded.workspaceId}
          action={completeOnboarding}
          country={country}
          taxName={COUNTRY_DEFAULTS[country].taxName}
          taxRate={bpsToPercent(COUNTRY_DEFAULTS[country].taxRateBps)}
          version={loaded.version}
          workspaceId={loaded.workspaceId}
        />
      ) : (
        <CountryStep />
      )}
    </>
  );
}
