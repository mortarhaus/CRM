"use server";

import { TEST_EMAIL_USER_LIMIT, TEST_EMAIL_WORKSPACE_LIMIT } from "@crm/core/security";
import { z } from "zod";
import { consumeUnit, giveBackUnit } from "@/db/system";
import { enqueueJob } from "@/jobs/enqueue";
import { ActionRefusedError, action } from "@/lib/auth/action";
import { recordAudit } from "@/lib/audit";

// Sign-up does not verify the address, so anyone can make an account with someone else's and be Owner of their own
// workspace: the test email is capped per user and per workspace (review P2-1). The keys hold IDs, never the
// address (UNI-09). A workspace refusal gives the user's unit back; a unit granted to a post that later fails stays
// spent (as for the auth limits, DECISIONS "Phase 1 PR 7").
async function takeTestEmailUnit(userId: string, workspaceId: string): Promise<void> {
  const userKey = `email-test:user:${userId}`;
  const user = await consumeUnit(userKey, TEST_EMAIL_USER_LIMIT);
  if (!user.allowed) throw new ActionRefusedError("RATE_LIMITED");
  const workspace = await consumeUnit(`email-test:ws:${workspaceId}`, TEST_EMAIL_WORKSPACE_LIMIT);
  if (workspace.allowed) return;
  await giveBackUnit(userKey, user.windowStart);
  throw new ActionRefusedError("RATE_LIMITED");
}

// The test email goes to the signed-in user's own address, read by the worker at send time: the job holds the two IDs
// and nothing else (PROJECT.md §9), and no field names the kind of email (the email.send queue has this one producer
// in Phase 1). "Email settings" are Admin and Owner (spec permission matrix; AUTH-03). The limit is taken in the
// handler: after the role check, so a refused post spends nothing, and after the key claim, so a replay spends nothing.
export const sendTestEmail = action({
  name: "email.sendTest",
  minRole: "admin",
  input: z.object({}),
  idempotent: true,
  handler: async ({ tx, userId, workspaceId }) => {
    await takeTestEmailUnit(userId, workspaceId);
    await enqueueJob(tx, "email.send", { workspaceId, userId });
    await recordAudit(tx, { actorUserId: userId, action: "email.test_requested", targetType: "user", targetId: userId });
    return { queued: true };
  },
});
