import { DEFAULT_ACCENT } from "@crm/core/branding";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { BRANDING_FORBIDDEN, BRANDING_INTRO, LOGO_ALT, LOGO_HEADING, LOGO_NONE } from "@/lib/auth/messages";
import { logoUrl } from "@/lib/uploads/logo";
import { updateBrandingSettings } from "../actions";
import { uploadLogo } from "./actions";
import { BrandingForm } from "./branding-form";
import { LogoForm } from "./logo-form";

export const metadata: Metadata = { title: "Branding · CRM" };

// Branding is Admin and Owner (plan Q2). Staff see the refusal instead of the form; this check and the hidden nav link
// are for the page only, and the action checks the role again on every post (AUTH-02). The version is the one the
// form saves against (optimistic concurrency).
async function loadBranding(): Promise<{ colour: string; logoKey: string | null; version: number } | null> {
  try {
    const { workspaceId } = await requireWorkspaceMember("admin");
    const settings = await withWorkspace(workspaceId, (tx) => getSettings(tx));
    return { colour: settings.brandColour ?? DEFAULT_ACCENT, logoKey: settings.logoKey, version: settings.version };
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
            <section aria-labelledby="logo-heading" className="flex flex-col gap-4 border-t border-border pt-6">
              <h2 id="logo-heading" className="text-lg font-semibold">
                {LOGO_HEADING}
              </h2>
              {branding.logoKey ? (
                // Served by the same-origin route (files/logo), so img-src 'self' covers it; sized by classes only.
                // eslint-disable-next-line @next/next/no-img-element -- a private, session-bound image: next/image's optimiser would fetch it without the session.
                <img src={logoUrl(branding.logoKey)} alt={LOGO_ALT} className="max-h-24 max-w-48 self-start rounded-md border border-border bg-card object-contain p-2" />
              ) : (
                <p className="text-sm text-muted-foreground">{LOGO_NONE}</p>
              )}
              <LogoForm action={uploadLogo} version={branding.version} />
            </section>
          </>
        ) : (
          <p className="text-sm">{BRANDING_FORBIDDEN}</p>
        )}
      </div>
    </>
  );
}
