import { isResetRule } from "@crm/core/numbering";
import { isSupportedCountry } from "@crm/core/settings";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ensureInvoiceSequence } from "@/db/numbering/sequence";
import { getSettings } from "@/db/settings/workspace-settings";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { NUMBERING_FORBIDDEN, NUMBERING_INTRO, NUMBERING_TITLE, SETUP_PENDING } from "@/lib/auth/messages";
import { updateNumberingSettings } from "./actions";
import { NumberingForm, type NumberingValues } from "./numbering-form";

export const metadata: Metadata = { title: "Document numbering · CRM" };

type Loaded = { kind: "forbidden" } | { kind: "pending" } | { kind: "ready"; values: NumberingValues };

// Admin and Owner (spec line 792). Staff see the refusal instead of the form; the action checks the role again on
// every post (AUTH-02). The invoice counter of a workspace onboarded before it existed is created from the country's
// defaults on first open (idempotent, audited once).
async function load(): Promise<Loaded> {
  try {
    const { workspaceId, userId } = await requireWorkspaceMember("admin");
    return await withWorkspace(workspaceId, async (tx): Promise<Loaded> => {
      const settings = await getSettings(tx);
      if (settings.country === null || !isSupportedCountry(settings.country) || settings.timezone === null) return { kind: "pending" };
      const sequence = await ensureInvoiceSequence(tx, settings.country, userId);
      if (!sequence || !isResetRule(sequence.resetRule)) return { kind: "pending" };
      return {
        kind: "ready",
        values: {
          version: sequence.version,
          pattern: sequence.pattern,
          resetRule: sequence.resetRule,
          counter: sequence.counter,
          lastResetPeriod: sequence.lastResetPeriod,
          shortCode: settings.shortCode,
          timeZone: settings.timezone,
          // The preview is for this instant on the server and in the browser alike (no hydration difference).
          at: new Date().toISOString(),
        },
      };
    });
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    // An Admin or Owner without 2FA in a workspace that requires it (require_2fa) enrols first.
    if (error.status === "TWO_FACTOR_REQUIRED") redirect("/settings/security");
    return { kind: "forbidden" };
  }
}

export default async function NumberingSettingsPage() {
  const loaded = await load();

  return (
    <>
      <h1 className="text-2xl font-semibold">{NUMBERING_TITLE}</h1>
      <div className="flex max-w-2xl flex-col gap-4">
        {loaded.kind === "forbidden" ? (
          <p className="text-sm">{NUMBERING_FORBIDDEN}</p>
        ) : loaded.kind === "pending" ? (
          <p className="text-sm">{SETUP_PENDING}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{NUMBERING_INTRO}</p>
            <NumberingForm action={updateNumberingSettings} values={loaded.values} />
          </>
        )}
      </div>
    </>
  );
}
