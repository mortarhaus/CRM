import { EMAIL_EVENTS, type EmailEvent, isEmailEvent } from "@crm/core/templates";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type EmailTemplateText, getEmailTemplate } from "@/db/templates/email-templates";
import { withWorkspace } from "@/db/workspace";
import { ActionRefusedError, requireWorkspaceMember } from "@/lib/auth/action";
import { TEMPLATE_EVENT_LABELS, TEMPLATES_EVENTS, TEMPLATES_FORBIDDEN, TEMPLATES_INTRO, TEMPLATES_TITLE } from "@/lib/auth/messages";
import { cn } from "@/lib/utils";
import { saveEmailTemplateAction } from "./actions";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Email templates · CRM" };

type Loaded = { kind: "forbidden" } | { kind: "ready"; template: EmailTemplateText };

// Admin and Owner (spec line 792). Staff see the refusal instead of the form; each action checks the role again
// (AUTH-02). An event the workspace has not saved shows its default text (core, Q23).
async function load(event: EmailEvent): Promise<Loaded> {
  try {
    const { workspaceId } = await requireWorkspaceMember("admin");
    return await withWorkspace(workspaceId, async (tx): Promise<Loaded> => ({ kind: "ready", template: await getEmailTemplate(tx, event) }));
  } catch (error) {
    if (!(error instanceof ActionRefusedError)) throw error;
    if (error.status === "UNAUTHENTICATED") redirect("/sign-in");
    if (error.status === "NO_WORKSPACE") redirect("/workspaces");
    // An Admin or Owner without 2FA in a workspace that requires it (require_2fa) enrols first.
    if (error.status === "TWO_FACTOR_REQUIRED") redirect("/settings/security");
    return { kind: "forbidden" };
  }
}

// The query names which email to edit (a view choice only); an unknown one shows the first.
export default async function EmailTemplatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const requested = (await searchParams).event;
  const event: EmailEvent = isEmailEvent(requested) ? requested : "invoice_sent";
  const loaded = await load(event);

  return (
    <>
      <h1 className="text-2xl font-semibold">{TEMPLATES_TITLE}</h1>
      {loaded.kind === "forbidden" ? (
        <p className="text-sm">{TEMPLATES_FORBIDDEN}</p>
      ) : (
        <div className="flex flex-col gap-8">
          <p className="max-w-2xl text-sm text-muted-foreground">{TEMPLATES_INTRO}</p>
          <nav aria-labelledby="events-heading">
            <h2 id="events-heading" className="mb-2 text-lg font-semibold">
              {TEMPLATES_EVENTS}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {EMAIL_EVENTS.map((item) => (
                <li key={item}>
                  <Link
                    href={`/settings/templates?event=${item}`}
                    aria-current={item === event ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm",
                      item === event ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {TEMPLATE_EVENT_LABELS[item]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <section aria-labelledby="template-heading" className="flex max-w-2xl min-w-0 flex-col gap-6">
            <h2 id="template-heading" className="text-lg font-semibold">
              {TEMPLATE_EVENT_LABELS[event]}
            </h2>
            <TemplateForm key={event} action={saveEmailTemplateAction} template={loaded.template} />
          </section>
        </div>
      )}
    </>
  );
}
