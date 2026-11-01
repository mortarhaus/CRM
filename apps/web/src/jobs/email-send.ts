import { z } from "zod";
import { createEmailAdapter, type EmailAdapter } from "../adapters/email";
import { findMembership, getUserEmail } from "../db/system";
import { withWorkspace } from "../db/workspace";
import { renderTestEmail } from "../emails/test-email";
import { recordAudit } from "../lib/audit";
import { getWorkerEnv } from "../lib/env";
import type { Handler } from "./handlers";

// z.object drops keys it does not name, so job data from a later producer version still works (EVT-03).
const jobData = z.object({ workspaceId: z.uuid(), userId: z.uuid() });

// No id and no address in the message: pg-boss stores it in the job's output (UNI-09).
export class RecipientNotMemberError extends Error {
  override readonly name = "RecipientNotMemberError";

  constructor() {
    super("recipient is not a member of the workspace");
  }
}

let workerAdapter: EmailAdapter | undefined;

// Built on the first job, not when the handler table loads: tests load it without the worker's email settings. The
// worker has already checked them at start (getWorkerEnv in worker.ts).
function adapterFromEnv(): EmailAdapter {
  workerAdapter ??= createEmailAdapter(getWorkerEnv());
  return workerAdapter;
}

// The worker's email.send handler. The queue has one producer in Phase 1, the settings test email (plan Task 27), so
// the queue fixes the operation; job data carries IDs only and no field selects a kind. The address is read here, at
// send time. A missing or non-uuid ID, or a user who is no longer a member, fails the job, so it retries and then
// dead-letters (EVT-05). The email is sent before the audit transaction opens, so no transaction waits on SMTP; a
// failed audit write retries the job and may send the test email twice.
export function emailSendHandler(adapter: () => EmailAdapter = adapterFromEnv): Handler {
  return async (jobs) => {
    for (const job of jobs) {
      const parsed = jobData.safeParse(job.data);
      if (!parsed.success) throw new Error("job data is not { workspaceId, userId }");
      const { workspaceId, userId } = parsed.data;
      const [membership, to] = await Promise.all([findMembership(userId, workspaceId), getUserEmail(userId)]);
      if (!membership || to === null) throw new RecipientNotMemberError();
      await adapter().send({ to, ...(await renderTestEmail()) });
      await withWorkspace(workspaceId, (tx) =>
        recordAudit(tx, { actorUserId: null, action: "email.test_sent", targetType: "user", targetId: userId }),
      );
    }
  };
}
