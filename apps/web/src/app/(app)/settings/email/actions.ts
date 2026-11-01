"use server";

import { z } from "zod";
import { enqueueJob } from "@/jobs/enqueue";
import { action } from "@/lib/auth/action";
import { recordAudit } from "@/lib/audit";

// The test email goes to the signed-in user's own address, read by the worker at send time: the job holds the two IDs
// and nothing else (PROJECT.md §9), and no field names the kind of email (the email.send queue has this one producer
// in Phase 1). "Email settings" are Admin and Owner (spec permission matrix; AUTH-03).
export const sendTestEmail = action({
  name: "email.sendTest",
  minRole: "admin",
  input: z.object({}),
  idempotent: true,
  handler: async ({ tx, userId, workspaceId }) => {
    await enqueueJob(tx, "email.send", { workspaceId, userId });
    await recordAudit(tx, { actorUserId: userId, action: "email.test_requested", targetType: "user", targetId: userId });
    return { queued: true };
  },
});
