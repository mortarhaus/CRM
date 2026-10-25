import { redactPii } from "@crm/core/audit";
import { sql } from "drizzle-orm";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../db/workspace";

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before?: object | null;
  after?: object | null;
  piiFields?: readonly string[];
  ip?: string | null;
}

const asJson = (value: object | null | undefined, piiFields: readonly string[]) => {
  const redacted = redactPii((value ?? null) as Record<string, unknown> | null, piiFields);
  return redacted === null ? null : JSON.stringify(redacted);
};

// One append-only audit row in the transaction's workspace (spec "Audit, logging, privacy"). The caller never
// names the workspace: workspace_id is read from the transaction's setting (TEN-11), and the RESTRICTIVE policy
// checks it again. Listed PII fields are redacted in before and after.
export async function recordAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  if (currentWorkspaceId() === undefined) throw new NoWorkspaceError();
  const piiFields = entry.piiFields ?? [];
  await tx.execute(sql`
    insert into audit_log (workspace_id, actor_user_id, action, target_type, target_id, before, after, ip)
    values (
      (select nullif(current_setting('app.workspace_id', true), '')::uuid),
      ${entry.actorUserId}, ${entry.action}, ${entry.targetType}, ${entry.targetId},
      ${asJson(entry.before, piiFields)}::jsonb, ${asJson(entry.after, piiFields)}::jsonb, ${entry.ip ?? null}
    )`);
}
