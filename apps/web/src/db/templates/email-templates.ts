import { EMAIL_TEMPLATE_DEFAULTS, type EmailEvent } from "@crm/core/templates";
import { and, eq, sql } from "drizzle-orm";
import { recordAudit } from "../../lib/audit";
import { emailTemplate } from "../schema";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../workspace";

// What a page shows and a save writes. version 0: the workspace has no row yet, so this is the event's default.
export interface EmailTemplateText {
  event: EmailEvent;
  subject: string;
  body: string;
  version: number;
  isDefault: boolean;
}

export class StaleTemplateError extends Error {
  constructor() {
    super("email_template changed since it was read");
    this.name = "StaleTemplateError";
  }
}

function workspaceId(): string {
  const id = currentWorkspaceId();
  if (id === undefined) throw new NoWorkspaceError();
  return id;
}

const defaultOf = (event: EmailEvent) => ({ subject: EMAIL_TEMPLATE_DEFAULTS[event].subject, body: EMAIL_TEMPLATE_DEFAULTS[event].body });
const sameAsDefault = (event: EmailEvent, subject: string, body: string) =>
  subject === defaultOf(event).subject && body === defaultOf(event).body;

async function findRow(tx: Tx, event: EmailEvent, options: { forUpdate?: boolean } = {}) {
  const query = tx
    .select()
    .from(emailTemplate)
    .where(and(eq(emailTemplate.workspaceId, workspaceId()), eq(emailTemplate.event, event)));
  const [row] = options.forUpdate ? await query.for("update") : await query;
  return row ?? null;
}

// The workspace's text for an event, or the default when it has saved none.
export async function getEmailTemplate(tx: Tx, event: EmailEvent): Promise<EmailTemplateText> {
  const row = await findRow(tx, event);
  if (!row) return { event, ...defaultOf(event), version: 0, isDefault: true };
  return { event, subject: row.subject, body: row.body, version: row.version, isDefault: sameAsDefault(event, row.subject, row.body) };
}

// A save, to the version the caller read (0: no row yet, so the row is created). The caller has checked the text
// (templateProblems). Audited with the text before and after; an unchanged save writes nothing. Restoring the default
// is a save of the default text. StaleTemplateError when someone saved since.
export async function saveEmailTemplate(
  tx: Tx,
  event: EmailEvent,
  text: { subject: string; body: string },
  expectedVersion: number,
  actorUserId: string,
): Promise<EmailTemplateText> {
  const current = await findRow(tx, event, { forUpdate: true });
  if ((current?.version ?? 0) !== expectedVersion) throw new StaleTemplateError();
  const before = current ? { subject: current.subject, body: current.body } : defaultOf(event);
  if (before.subject === text.subject && before.body === text.body) return getEmailTemplate(tx, event);

  const [saved] = current
    ? await tx
        .update(emailTemplate)
        .set({ ...text, version: sql`${emailTemplate.version} + 1`, updatedAt: sql`now()` })
        .where(and(eq(emailTemplate.workspaceId, current.workspaceId), eq(emailTemplate.event, event)))
        .returning()
    : // A concurrent first save holds the key: this one is then stale.
      await tx.insert(emailTemplate).values({ workspaceId: workspaceId(), event, ...text }).onConflictDoNothing().returning();
  if (!saved) throw new StaleTemplateError();
  await recordAudit(tx, {
    actorUserId,
    action: sameAsDefault(event, text.subject, text.body) ? "email_template.restored" : "email_template.updated",
    targetType: "email_template",
    targetId: null,
    before: { event, subject: before.subject, body: before.body, version: current?.version ?? 0 },
    after: { event, subject: saved.subject, body: saved.body, version: saved.version },
  });
  return { event, subject: saved.subject, body: saved.body, version: saved.version, isDefault: sameAsDefault(event, saved.subject, saved.body) };
}
