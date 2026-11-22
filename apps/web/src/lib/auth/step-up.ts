import { createHmac, hkdfSync } from "node:crypto";
import { STEP_UP_CODE_REUSE_SECONDS, STEP_UP_VERIFY_USER_FAILURE_LIMIT, STEP_UP_WINDOW_SECONDS } from "@crm/core/security";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { consumeUnit, giveBackUnit } from "../../db/system";
import type { Tx } from "../../db/workspace";
import { recordAudit } from "../audit";
import { getEnv } from "../env";
import { ActionRefusedError, action, type WorkspaceMember } from "./action";
import { postToAuth } from "./forward";

// Step-up (spec "Authorization": a fresh TOTP within the last 5 minutes for high-risk actions; AUTH-09; Phase 2 plan
// Task 13). verifyStepUp records that this session passed a TOTP check in the active workspace; requireStepUp, called
// by a high-risk action's handler, refuses unless that happened in the last STEP_UP_WINDOW_SECONDS. The row lives in
// the tenant table step_up (migrations 0028 and 0029; DECISIONS 2026-11-20).

// The transaction's workspace, as the policies read it; the RESTRICTIVE policy checks it again.
const CURRENT_WORKSPACE = sql`(select nullif(current_setting('app.workspace_id', true), '')::uuid)`;

// Whether this session verified a code in the transaction's workspace within the window. The age is measured on the
// database clock, the clock that wrote verified_at.
export async function hasFreshStepUp(tx: Tx, session: { id: string }): Promise<boolean> {
  const rows = await tx.execute(sql`
    select 1 from step_up
    where workspace_id = ${CURRENT_WORKSPACE} and session_id = ${session.id}
      and verified_at > now() - make_interval(secs => ${STEP_UP_WINDOW_SECONDS})`);
  return rows.length > 0;
}

// Refuses with STEP_UP_REQUIRED unless hasFreshStepUp.
export async function requireStepUp(tx: Tx, session: { id: string }): Promise<void> {
  if (!(await hasFreshStepUp(tx, session))) throw new ActionRefusedError("STEP_UP_REQUIRED");
}

const STEP_UP_CODE_KEY_INFO = "crm step-up code v1";

// A used code is remembered by an HMAC under a key derived from AUTH_SECRET, never as the code or a plain hash: a
// six-digit code's SHA-256 is reversed by trying all 10^6.
function usedCodeKey(userId: string, code: string): string {
  const key = Buffer.from(hkdfSync("sha256", getEnv().AUTH_SECRET, "", STEP_UP_CODE_KEY_INFO, 32));
  return `step-up:code:${userId}:${createHmac("sha256", key).update(code).digest("base64url")}`;
}

// The code check, outside the workspace transaction (action()'s beforeTransaction): Better Auth's request takes its
// own connection and transaction from the same pool, so running it inside ours could exhaust the pool under load.
async function checkCode(member: WorkspaceMember, { code }: { code: string }): Promise<void> {
  // Q16: a user without 2FA cannot step up; the page sends them to enrol (/settings/security).
  if (!member.twoFactorEnabled) throw new ActionRefusedError("TWO_FACTOR_REQUIRED");
  // Per user, besides Better Auth's per-IP row for /two-factor/verify-totp (two-factor-verify, which the post below
  // consumes): with a session in hand, guesses could otherwise come from many addresses. Failures only, as the
  // sign-in account cap: every check takes a unit first, and an accepted code gives it back (DECISIONS 2026-11-22).
  const userKey = `step-up:user:${member.userId}`;
  const unit = await consumeUnit(userKey, STEP_UP_VERIFY_USER_FAILURE_LIMIT);
  if (!unit.allowed) throw new ActionRefusedError("RATE_LIMITED");
  // With a session cookie Better Auth 1.7.14 checks the code against the user's verified TOTP secret and answers with
  // the same session: it issues, rotates and revokes nothing (spike, DECISIONS 2026-11-20).
  const result = await postToAuth("/two-factor/verify-totp", { code });
  if (result.status === 429) throw new ActionRefusedError("RATE_LIMITED");
  // Better Auth failed (Bob PR #68 P3): not a wrong code, so the user is not told to retype a right one. It throws to
  // the page's error handling; the unit stays spent, as for a sign-in that fails with a 500 (runbook).
  if (result.status >= 500) throw new Error(`Step-up code check failed: ${result.status}`);
  if (!result.ok) throw new ActionRefusedError("WRONG_CODE");
  // One use per code per user, across sessions and workspaces: Better Auth accepts a code for up to 90 s and keeps
  // no record of its use. The first use takes the only unit of the marker; any later one in its window is refused.
  const marker = await consumeUnit(usedCodeKey(member.userId, code), { windowSeconds: STEP_UP_CODE_REUSE_SECONDS, max: 1 });
  if (!marker.allowed) throw new ActionRefusedError("WRONG_CODE");
  await giveBackUnit(userKey, unit.windowStart);
}

// Not a server action itself: the step-up prompt exposes it from its page's actions file (settings/payment). Any member
// may step up; the high-risk action decides who may act.
export const verifyStepUp = action({
  name: "auth.stepUp",
  minRole: "staff",
  input: z.strictObject({ code: z.string().regex(/^\d{6}$/) }),
  idempotent: false,
  beforeTransaction: checkCode,
  handler: async ({ tx, userId, sessionId }) => {
    await tx.execute(sql`
      insert into step_up (workspace_id, session_id, verified_at)
      values (${CURRENT_WORKSPACE}, ${sessionId}, now())
      on conflict (workspace_id, session_id) do update set verified_at = excluded.verified_at`);
    await recordAudit(tx, { actorUserId: userId, action: "auth.step_up", targetType: "session", targetId: sessionId });
    return { verified: true };
  },
});
