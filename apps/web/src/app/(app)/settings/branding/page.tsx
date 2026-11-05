import { DEFAULT_ACCENT } from "@crm/core/branding";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { BRANDING_FORBIDDEN, BRANDING_INTRO } from "@/lib/auth/messages";
import { updateBrandingSettings } from "../actions";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Branding · CRM" };

// Branding is Admin and Owner (plan Q2). Staff see the refusal instead of the form; this check and the hidden nav link
// are for the page only, and the action checks the role again on every post (AUTH-02). The version is the one the
// form saves against (optimistic concurrency).
async function loadBranding(): Promise<{ colour: string; version: number } | null> {
  try {
    const { workspaceId } = await requireWorkspaceMember("admin");
    const settings = await withWorkspace(workspaceId, (tx) => getSettings(tx));
    return { colour: settings.brandColour ?? DEFAULT_ACCENT, version: settings.version };
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    return null;
  }
}

export default async function BrandingSettingsPage() {
  const branding = await loadBranding();

  return (
    <>
      <h1 className="text-2xl font-semibold">Branding</h1>
      <div className="flex max-w-2xl flex-col gap-4">
        {branding ? (
          <>
            <p className="text-sm text-muted-foreground">{BRANDING_INTRO}</p>
            <BrandingForm action={updateBrandingSettings} saved={branding.colour} version={branding.version} />
          </>
        ) : (
          <p className="text-sm">{BRANDING_FORBIDDEN}</p>
        )}
      </div>
    </>
  );
}
