import { type DateFormat, DATE_FORMATS, formatDateTime, isSupportedCountry } from "@crm/core/settings";
import { z } from "zod";
import { createEmailAdapter, type EmailAdapter } from "../adapters/email";
import { BANK_DETAILS_AUDIT_ACTION, findEmailSettings } from "../db/settings/workspace-settings";
import { findMembership, getUserContact, getWorkspaceName } from "../db/system";
import { withWorkspace } from "../db/workspace";
import { renderBankDetailsChangedEmail } from "../emails/bank-details-changed";
import { findAuditEntry } from "../lib/audit";
import { PAYMENT_QR_GENERIC, PAYMENT_QR_NAMES } from "../lib/auth/messages";
import { getWorkerEnv } from "../lib/env";
import type { Handler } from "./handlers";
import { logInfo } from "./log";

const BANK_DETAILS_EMAIL_QUEUE = "email.bank_details_changed";

// z.object drops keys it does not name, so job data from a later producer version still works (EVT-03).
const jobData = z.object({ workspaceId: z.uuid(), changeId: z.uuid(), userId: z.uuid() });

// The audit entry's changed column names give the kind of change; the job reads only those names, never a value
// (findAuditEntry), so no account number fragment or "[pii]" marker reaches the worker (DECISIONS 2026-11-27).
const BANK_COLUMNS = ["bank_name", "bank_account_holder", "bank_account_number", "bank_swift_code"];
const QR_COLUMN = "duitnow_qr_key";
// A workspace changes its payment details only once onboarded (NOT_ONBOARDED), so both are set; these are for a row
// that lost them since.
const FALLBACK_DATE_FORMAT: DateFormat = "dd-mmm-yyyy";
const FALLBACK_TIME_ZONE = "UTC";
// The actor's account was deleted since (audit_log.actor_user_id is set null).
const UNKNOWN_ACTOR = "a user who no longer has an account";

// No id, no address and no value in the message: pg-boss stores it in the job's output (UNI-09).
export class BankDetailsChangeNotFoundError extends Error {
  override readonly name = "BankDetailsChangeNotFoundError";

  constructor() {
    super("bank details change not found");
  }
}

let workerAdapter: EmailAdapter | undefined;

function adapterFromEnv(): EmailAdapter {
  workerAdapter ??= createEmailAdapter(getWorkerEnv());
  return workerAdapter;
}

function whatChanged(columns: string[], qrName: string): string {
  const kinds = [
    ...(columns.some((column) => BANK_COLUMNS.includes(column)) ? ["bank details"] : []),
    ...(columns.includes(QR_COLUMN) ? [`the ${qrName}`] : []),
  ];
  return kinds.join(" and ");
}

const isDateFormat = (value: string | null): value is DateFormat => (DATE_FORMATS as readonly (string | null)[]).includes(value);

// The worker's handler for the owner email on a bank-details or payment QR change (spec "Authorization"; plan Task 16).
// The action enqueues one job per Owner in the change's transaction, with IDs only ({ workspaceId, changeId, userId })
// and an id made from the change and the Owner, so a repeated enqueue makes one job (EVT-01). Everything else is read
// here: the change from its audit entry, the names and the address at send time. Sending is the last step, so a retry
// follows only a failed send (or a crash before pg-boss completes the job). A change that cannot be found fails the
// job (retries, then email.bank_details_changed.dead; EVT-05). A recipient who is no longer an Owner, or has no
// account or address, is skipped: the job completes and the log names the reason only (UNI-09).
//
// One job per call, as email.send: the worker fetches one job at a time (batchSize 1).
export function bankDetailsEmailHandler(adapter: () => EmailAdapter = adapterFromEnv): Handler {
  return async (jobs, { log }) => {
    const [job] = jobs;
    if (jobs.length !== 1 || !job) throw new Error(`${BANK_DETAILS_EMAIL_QUEUE} handles one job per call`);
    const parsed = jobData.safeParse(job.data);
    if (!parsed.success) throw new Error("job data is not { workspaceId, changeId, userId }");
    const { workspaceId, changeId, userId } = parsed.data;

    const change = await withWorkspace(workspaceId, async (tx) => {
      const entry = await findAuditEntry(tx, changeId, BANK_DETAILS_AUDIT_ACTION);
      return entry && { ...entry, settings: await findEmailSettings(tx) };
    });
    if (!change) throw new BankDetailsChangeNotFoundError();

    const [membership, owner, actor, workspaceName] = await Promise.all([
      findMembership(userId, workspaceId),
      getUserContact(userId),
      change.actorUserId ? getUserContact(change.actorUserId) : null,
      getWorkspaceName(workspaceId),
    ]);
    if (membership?.role !== "owner" || !owner?.email || workspaceName === null) {
      const reason = membership?.role !== "owner" ? "not_owner" : !owner?.email ? "no_address" : "no_workspace";
      logInfo(log, "owner email skipped", { queue: BANK_DETAILS_EMAIL_QUEUE, reason });
      return;
    }

    const { country, timezone, dateFormat } = change.settings;
    const qrName = country && isSupportedCountry(country) ? PAYMENT_QR_NAMES[country] : PAYMENT_QR_GENERIC;
    const email = await renderBankDetailsChangedEmail({
      owner_name: owner.name,
      workspace_name: workspaceName,
      changed_at: formatDateTime(
        change.createdAt,
        timezone ?? FALLBACK_TIME_ZONE,
        isDateFormat(dateFormat) ? dateFormat : FALLBACK_DATE_FORMAT,
      ),
      changed_by: actor?.name ?? UNKNOWN_ACTOR,
      what_changed: whatChanged(change.changedColumns, qrName),
    });
    await adapter().send({ to: owner.email, ...email });
  };
}
