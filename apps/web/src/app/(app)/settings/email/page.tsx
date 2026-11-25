import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { TEST_EMAIL_FORBIDDEN, TEST_EMAIL_INTRO } from "@/lib/auth/messages";
import { sendTestEmail } from "./actions";
import { SendTestEmailForm } from "./send-test-email-form";

export const metadata: Metadata = { title: "Email · CRM" };

// Staff see the refusal instead of the form. This check and the hidden nav link are for the page only; the action
// checks the role again on every post (AUTH-02).
// The workspace the page is rendered for, or null for a refusal.
async function renderedWorkspace(): Promise<string | null> {
  try {
    return (await requireWorkspaceMember("admin")).workspaceId;
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    // An Admin or Owner without 2FA in a workspace that requires it (require_2fa) enrols first.
    if (error.status === "TWO_FACTOR_REQUIRED") redirect("/settings/security");
    return null;
  }
}

export default async function EmailSettingsPage() {
  const workspaceId = await renderedWorkspace();

  return (
    <>
      <h1 className="text-2xl font-semibold">Email</h1>
      <div className="flex max-w-xl flex-col gap-4">
        {workspaceId ? (
          <>
            <p className="text-sm text-muted-foreground">{TEST_EMAIL_INTRO}</p>
            {/* The rendered workspace and a new idempotency key on every render, bound on the server: a repeated post
                of this page answers with the first result instead of sending again, and one after a workspace switch
                is refused. Without JavaScript Next puts them in the form. */}
            <SendTestEmailForm key={workspaceId} action={sendTestEmail.bind(null, { workspaceId }, randomUUID())} />
          </>
        ) : (
          <p className="text-sm">{TEST_EMAIL_FORBIDDEN}</p>
        )}
      </div>
    </>
  );
}
