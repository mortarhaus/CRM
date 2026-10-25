import { createHash } from "node:crypto";
import { IDEMPOTENCY_KEY_EXPIRY_SECONDS, IDEMPOTENCY_KEY_MAX_LENGTH } from "@crm/core/security";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { findMembership, healWorkspaceSettings, type WorkspaceRole } from "../../db/system";
import { type Tx, withWorkspace } from "../../db/workspace";
import { getCurrentSession } from "./session";

export type Role = WorkspaceRole;

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type Refusal = "UNAUTHENTICATED" | "NO_WORKSPACE" | "FORBIDDEN";

export type ActionResult<O> =
  | { ok: true; status: "DONE" | "REPLAYED"; data: O }
  | { ok: false; status: Refusal | "IDEMPOTENCY_KEY_REUSED" }
  // Field paths only, never the submitted values (UNI-09).
  | { ok: false; status: "INVALID_INPUT"; fields: string[] };

export interface ActionContext {
  tx: Tx;
  userId: string;
  workspaceId: string;
  role: Role;
}

export class ActionRefusedError extends Error {
  constructor(readonly status: Refusal) {
    super(`Action refused: ${status}`);
    this.name = "ActionRefusedError";
  }
}

const RANK: Record<Role, number> = { staff: 1, admin: 2, owner: 3 };

// The workspace a request acts in is the session's active workspace and nothing else (spec Tenancy, TEN-11); the
// role is read from member for that workspace, so a stale active workspace has no role. A missing
// workspace_settings row is healed here (Task 7, plan Risk 6).
export async function requireWorkspaceMember(minRole: Role): Promise<{ userId: string; workspaceId: string; role: Role }> {
  const current = await getCurrentSession();
  if (!current) throw new ActionRefusedError("UNAUTHENTICATED");
  const workspaceId = current.session.activeOrganizationId;
  if (!workspaceId) throw new ActionRefusedError("NO_WORKSPACE");
  const membership = await findMembership(current.user.id, workspaceId);
  if (!membership || RANK[membership.role] < RANK[minRole]) throw new ActionRefusedError("FORBIDDEN");
  await healWorkspaceSettings(workspaceId);
  return { userId: current.user.id, workspaceId, role: membership.role };
}

// Canonical JSON of the parsed input: object keys sorted, so the same request always hashes the same.
function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  if (typeof value === "bigint") return JSON.stringify({ $bigint: value.toString() });
  if (value instanceof Date) return JSON.stringify({ $date: value.toISOString() });
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? "null" : canonical(item))).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  throw new TypeError(`Action input holds a value that cannot be hashed: ${typeof value}`);
}

const requestHash = (input: unknown) => createHash("sha256").update(canonical(input)).digest("hex");

const validKey = (key: unknown): key is string =>
  typeof key === "string" && key.length >= 1 && key.length <= IDEMPOTENCY_KEY_MAX_LENGTH;

const fieldPaths = (error: z.ZodError) => [...new Set(error.issues.map((issue) => issue.path.map(String).join(".")))];

// The transaction's workspace, as the policies read it; the RESTRICTIVE policy checks it again.
const CURRENT_WORKSPACE = sql`(select nullif(current_setting('app.workspace_id', true), '')::uuid)`;

type Claim = { kind: "claimed" } | { kind: "replay"; response: unknown } | { kind: "reused" };

// Step 5: claim the key, or find the earlier request that holds it. A concurrent request with the same key waits on
// the primary key until this transaction ends, then sees its committed row (or claims the key after a rollback).
async function claimKey(tx: Tx, name: string, key: string, hash: string): Promise<Claim> {
  await tx.execute(sql`
    delete from idempotency_key where workspace_id = ${CURRENT_WORKSPACE} and key = ${key} and expires_at <= now()`);
  const claimed = await tx.execute(sql`
    insert into idempotency_key (workspace_id, key, action, request_hash, expires_at)
    values (${CURRENT_WORKSPACE}, ${key}, ${name}, decode(${hash}, 'hex'),
      now() + make_interval(secs => ${IDEMPOTENCY_KEY_EXPIRY_SECONDS}))
    on conflict (workspace_id, key) do nothing
    returning key`);
  if (claimed.length === 1) return { kind: "claimed" };
  const [earlier] = await tx.execute<{ same: boolean; response: unknown }>(sql`
    select (action = ${name} and request_hash = decode(${hash}, 'hex')) as same, response
    from idempotency_key where workspace_id = ${CURRENT_WORKSPACE} and key = ${key}`);
  if (!earlier) throw new Error("Idempotency key neither claimed nor found");
  return earlier.same ? { kind: "replay", response: earlier.response } : { kind: "reused" };
}

// The one wrapper for every mutating server action (spec "Validation"; AUTH-01). The order is fixed: (1) session,
// (2) the session's active workspace, (3) role, (4) Zod, (5) idempotency, (6) the handler, in the same transaction
// as the claimed key, then its response is stored. No input value is read before step 4.
export function action<I, O extends Json>(spec: {
  name: string;
  minRole: Role;
  input: z.ZodType<I>;
  idempotent: boolean;
  handler: (ctx: ActionContext, input: I) => Promise<O>;
}): (raw: unknown, idempotencyKey?: string) => Promise<ActionResult<O>> {
  return async (raw, idempotencyKey) => {
    let member: Awaited<ReturnType<typeof requireWorkspaceMember>>;
    try {
      member = await requireWorkspaceMember(spec.minRole);
    } catch (error) {
      if (error instanceof ActionRefusedError) return { ok: false, status: error.status };
      throw error;
    }
    const parsed = spec.input.safeParse(raw);
    if (!parsed.success) return { ok: false, status: "INVALID_INPUT", fields: fieldPaths(parsed.error) };
    if (spec.idempotent && !validKey(idempotencyKey)) return { ok: false, status: "INVALID_INPUT", fields: ["idempotencyKey"] };
    const input = parsed.data;

    return withWorkspace(member.workspaceId, async (tx): Promise<ActionResult<O>> => {
      const ctx = { tx, ...member };
      if (!spec.idempotent || idempotencyKey === undefined) return { ok: true, status: "DONE", data: await spec.handler(ctx, input) };
      const claim = await claimKey(tx, spec.name, idempotencyKey, requestHash(input));
      if (claim.kind === "replay") return { ok: true, status: "REPLAYED", data: claim.response as O };
      if (claim.kind === "reused") return { ok: false, status: "IDEMPOTENCY_KEY_REUSED" };
      const data = await spec.handler(ctx, input);
      await tx.execute(sql`
        update idempotency_key set response = ${JSON.stringify(data)}::jsonb
        where workspace_id = ${CURRENT_WORKSPACE} and key = ${idempotencyKey}`);
      return { ok: true, status: "DONE", data };
    });
  };
}
