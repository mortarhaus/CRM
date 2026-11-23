import { redactPii } from "@crm/core/audit";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../db/workspace";

export interface AuditEntry {
  // Given when the caller hands the entry's id on (a job that reports the change reads the entry by it).
  id?: string;
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
// checks it again. Listed PII fields are redacted in before and after. Returns the entry's id.
export async function recordAudit(tx: Tx, entry: AuditEntry): Promise<string> {
  if (currentWorkspaceId() === undefined) throw new NoWorkspaceError();
  const piiFields = entry.piiFields ?? [];
  const id = entry.id ?? randomUUID();
  await tx.execute(sql`
    insert into audit_log (id, workspace_id, actor_user_id, action, target_type, target_id, before, after, ip)
    values (
      ${id}, (select nullif(current_setting('app.workspace_id', true), '')::uuid),
      ${entry.actorUserId}, ${entry.action}, ${entry.targetType}, ${entry.targetId},
      ${asJson(entry.before, piiFields)}::jsonb, ${asJson(entry.after, piiFields)}::jsonb, ${entry.ip ?? null}
    )`);
  return id;
}

// One entry of the transaction's workspace by id and action (RLS shows no other workspace's), or null.
export async function findAuditEntry(
  tx: Tx,
  id: string,
  action: string,
): Promise<{ actorUserId: string | null; after: Record<string, unknown> | null; createdAt: Date } | null> {
  const [row] = await tx.execute<{ actor_user_id: string | null; after: Record<string, unknown> | null; created_at: Date | string }>(sql`
    select actor_user_id, after, created_at from audit_log where id = ${id} and action = ${action}`);
  return row ? { actorUserId: row.actor_user_id, after: row.after, createdAt: new Date(row.created_at) } : null;
}
