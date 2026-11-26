import { createHash } from "node:crypto";
import { IDEMPOTENCY_KEY_EXPIRY_SECONDS, IDEMPOTENCY_KEY_MAX_LENGTH } from "@crm/core/security";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requiresTwoFactor } from "../../db/settings/workspace-settings";
import { findMembership, healWorkspaceSettings, type WorkspaceRole } from "../../db/system";
import { type Tx, withWorkspace } from "../../db/workspace";
import { RENDERED_WORKSPACE_FIELD } from "../forms";
import { getCurrentSession } from "./session";

export type Role = WorkspaceRole;

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// RATE_LIMITED, STALE_VERSION and NOT_ONBOARDED are thrown by a handler (an action's own limit, e.g. the test email; a
// row changed since the caller read its version, e.g. the settings; a settings write before the Owner has onboarded
// the workspace); so are the upload refusals (an empty, too large or not allowed file, by its bytes; storage not
// configured); so is PERIOD_BEHIND (a numbering change at a time before the period of the last number, in the workspace
// time zone: PeriodBehindError); so are CURRENCY_LOCKED (a service's currency change while it has a default price,
// spec Money rules "Service currency edit") and NOT_FOUND (no such row in the workspace); the others by the checks below. TWO_FACTOR_REQUIRED (the user has no 2FA: enrol first) comes from the
// require_2fa check below or from step-up; STEP_UP_REQUIRED (no step-up of this session in the last
// STEP_UP_WINDOW_SECONDS) from requireStepUp; WRONG_CODE from verifyStepUp (step-up.ts). WORKSPACE_CHANGED: a post
// from a page rendered for another workspace than the session's active one, or one that names none (step 2 below).
type Refusal =
  | "UNAUTHENTICATED"
  | "NO_WORKSPACE"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "STALE_VERSION"
  | "NOT_ONBOARDED"
  | "PERIOD_BEHIND"
  | "CURRENCY_LOCKED"
  | "NOT_FOUND"
  | "UPLOAD_EMPTY"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_TYPE_NOT_ALLOWED"
  | "STORAGE_UNAVAILABLE"
  | "TWO_FACTOR_REQUIRED"
  | "STEP_UP_REQUIRED"
  | "WRONG_CODE"
  | "WORKSPACE_CHANGED";

export type ActionResult<O> =
  | { ok: true; status: "DONE" | "REPLAYED"; data: O }
  | { ok: false; status: Refusal | "IDEMPOTENCY_KEY_REUSED" }
  // Field paths only, never the submitted values (UNI-09); for a posted form, also the values its action's `echo`
  // names as safe to show again (never a secret or personal data), so a page posted without JavaScript can render them.
  | { ok: false; status: "INVALID_INPUT"; fields: string[]; echo?: Record<string, string> };

export interface ActionContext {
  tx: Tx;
  userId: string;
  // The Better Auth session the request came with: step-up is bound to it (step-up.ts).
  sessionId: string;
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
// workspace_settings row is healed here (Task 7, plan Risk 6). In a workspace with require_2fa, an Admin or Owner
// without 2FA is refused with TWO_FACTOR_REQUIRED whatever the minimum role (spec "Authentication and sessions":
// "`require_2fa` per workspace for owner/admin"; ASK 9, DECISIONS 2026-11-15); a page sends them to enrol.
// `rendered` (action() always passes it) is the workspace the posting page was rendered for: anything but the
// session's workspace is refused before membership is read, so nothing is read or written for either workspace.
export interface WorkspaceMember {
  userId: string;
  sessionId: string;
  twoFactorEnabled: boolean;
  workspaceId: string;
  role: Role;
}

// `rendered` reads the workspace the posting page was rendered for; it is called only once the session is read.
export async function requireWorkspaceMember(minRole: Role, rendered?: () => string | null): Promise<WorkspaceMember> {
  const current = await getCurrentSession();
  if (!current) throw new ActionRefusedError("UNAUTHENTICATED");
  const workspaceId = current.session.activeOrganizationId;
  if (!workspaceId) throw new ActionRefusedError("NO_WORKSPACE");
  if (rendered !== undefined && rendered() !== workspaceId) throw new ActionRefusedError("WORKSPACE_CHANGED");
  const membership = await findMembership(current.user.id, workspaceId);
  if (!membership || RANK[membership.role] < RANK[minRole]) throw new ActionRefusedError("FORBIDDEN");
  await healWorkspaceSettings(workspaceId);
  const twoFactorEnabled = current.user.twoFactorEnabled === true;
  if (RANK[membership.role] >= RANK.admin && !twoFactorEnabled && (await withWorkspace(workspaceId, requiresTwoFactor))) {
    throw new ActionRefusedError("TWO_FACTOR_REQUIRED");
  }
  return { userId: current.user.id, sessionId: current.session.id, twoFactorEnabled, workspaceId, role: membership.role };
}

// A plain object (an object literal, Zod's object and record output, or one with no prototype). Any other object
// (a Set, a Map, a Blob or File, a class instance) has state Object.entries does not see, so it would hash as {}.
function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Canonical JSON of the parsed input: object keys sorted, so the same request always hashes the same. A value it
// cannot represent exactly is refused with a TypeError, never hashed as something else (PR #44 Round 2 P3-1).
function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  if (typeof value === "bigint") return JSON.stringify({ $bigint: value.toString() });
  if (value instanceof Date) return JSON.stringify({ $date: value.toISOString() });
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? "null" : canonical(item))).join(",")}]`;
  if (typeof value === "object" && isPlainObject(value)) {
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

const isRecord = (raw: unknown): raw is Record<string, unknown> => typeof raw === "object" && raw !== null && !Array.isArray(raw);

// Step 2's precondition, read after the session: the workspace the posting page was rendered for, from its form
// (RENDERED_WORKSPACE_FIELD) or, for a caller that passes an object, from that one key. No other input value is read
// here (PR 77 Review R1 P1). Never a destination (TEN-11): it is only compared with the session's workspace.
function renderedOf(raw: unknown, form: FormData | null): string | null {
  const value = form ? form.get(RENDERED_WORKSPACE_FIELD) : isRecord(raw) ? raw[RENDERED_WORKSPACE_FIELD] : null;
  return typeof value === "string" ? value : null;
}

// After step 3, right before Zod: an object input without the rendered workspace, which Zod never sees.
const withoutRendered = (raw: unknown): unknown =>
  isRecord(raw) ? Object.fromEntries(Object.entries(raw).filter(([key]) => key !== RENDERED_WORKSPACE_FIELD)) : raw;

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
// (2) the session's active workspace, which must be the one the posting page was rendered for (renderedOf; there is
// no opt-out, so every action is bound: PR 76 Review R1 P0, DECISIONS 2026-11-25), (3) role, (4) Zod,
// (5) idempotency, (6) the handler, in the same transaction as the claimed key, then its response is stored. An
// action's beforeTransaction runs between steps 4 and 5, outside the transaction. No input value but the rendered
// workspace is read before step 4, and that one only after the session (PR 77 Review R1 P1). A handler that throws ActionRefusedError rolls the transaction back, claimed key
// included, and the refusal is the result.
export function action<I, O extends Json>(spec: {
  name: string;
  minRole: Role;
  input: z.ZodType<I>;
  idempotent: boolean;
  handler: (ctx: ActionContext, input: I) => Promise<O>;
  // A form posted through useActionState calls the action as (previousState, formData), with JavaScript or without.
  // An action that names fromForm takes its raw input from that form instead; Zod still checks it in step 4.
  fromForm?: (form: FormData) => unknown;
  // Where a done or replayed result sends the browser, after the transaction has committed: a redirect from the
  // action, which Next answers with a 303. Needed by a form that works without JavaScript when the page it was posted
  // from redirects once the action is done: a redirect while the page renders is a 307, which repeats the POST at
  // the new URL, where Next finds no such action. A refusal is still returned.
  redirectTo?: string;
  // With fromForm: the posted values a refused form shows again (INVALID_INPUT only). Without JavaScript the page is
  // rendered from the result, not from what was typed, so anything not echoed comes back empty. Only values that are
  // neither secret nor personal data; strings only, read from the form as posted.
  echo?: (form: FormData) => Record<string, string>;
  // Work that must not run inside the workspace transaction, after step 4 and before step 5: a call that takes a
  // connection of its own from the same pool (step-up's code check posts to Better Auth, whose request runs in its
  // own transaction), or a unit taken on the limiter's pool. It may refuse with ActionRefusedError.
  beforeTransaction?: (member: WorkspaceMember, input: I) => Promise<void>;
}): (raw: unknown, idempotencyKey?: string | FormData) => Promise<ActionResult<O>> {
  return async (raw, keyOrForm) => {
    const idempotencyKey = typeof keyOrForm === "string" ? keyOrForm : undefined;
    const form = keyOrForm instanceof FormData ? keyOrForm : null;
    const posted = form && spec.fromForm ? form : null;
    let member: WorkspaceMember;
    try {
      member = await requireWorkspaceMember(spec.minRole, () => renderedOf(raw, posted));
    } catch (error) {
      if (error instanceof ActionRefusedError) return { ok: false, status: error.status };
      throw error;
    }
    const parsed = spec.input.safeParse(posted && spec.fromForm ? spec.fromForm(posted) : withoutRendered(raw));
    if (!parsed.success) {
      const fields = fieldPaths(parsed.error);
      return form && spec.echo ? { ok: false, status: "INVALID_INPUT", fields, echo: spec.echo(form) } : { ok: false, status: "INVALID_INPUT", fields };
    }
    if (spec.idempotent && !validKey(idempotencyKey)) return { ok: false, status: "INVALID_INPUT", fields: ["idempotencyKey"] };
    const input = parsed.data;
    if (spec.beforeTransaction) {
      try {
        await spec.beforeTransaction(member, input);
      } catch (error) {
        if (error instanceof ActionRefusedError) return { ok: false, status: error.status };
        throw error;
      }
    }

    const result = await withWorkspace(member.workspaceId, async (tx): Promise<ActionResult<O>> => {
      const { userId, sessionId, workspaceId, role } = member;
      const ctx: ActionContext = { tx, userId, sessionId, workspaceId, role };
      if (!spec.idempotent || idempotencyKey === undefined) return { ok: true, status: "DONE", data: await spec.handler(ctx, input) };
      const claim = await claimKey(tx, spec.name, idempotencyKey, requestHash(input));
      if (claim.kind === "replay") return { ok: true, status: "REPLAYED", data: claim.response as O };
      if (claim.kind === "reused") return { ok: false, status: "IDEMPOTENCY_KEY_REUSED" };
      const data = await spec.handler(ctx, input);
      await tx.execute(sql`
        update idempotency_key set response = ${JSON.stringify(data)}::jsonb
        where workspace_id = ${CURRENT_WORKSPACE} and key = ${idempotencyKey}`);
      return { ok: true, status: "DONE", data };
    }).catch((error: unknown): ActionResult<O> => {
      if (error instanceof ActionRefusedError) return { ok: false, status: error.status };
      throw error;
    });
    if (result.ok && spec.redirectTo !== undefined) redirect(spec.redirectTo);
    return result;
  };
}
