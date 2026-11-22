import { randomUUID } from "node:crypto";
import { notification } from "../schema";
import { currentWorkspaceId, NoWorkspaceError, type Tx } from "../workspace";

// What a notification is about. One kind so far: a bank-details or payment QR change (spec "Authorization").
export type NotificationKind = "bank_details_changed";

// In-app notifications (the notification table, migrations 0019 and 0020): one unread row per user, in the
// transaction's workspace (TEN-11), written with the change it reports.
export async function notifyUsers(
  tx: Tx,
  userIds: readonly string[],
  entry: { kind: NotificationKind; targetType: string; targetId: string },
): Promise<void> {
  const workspaceId = currentWorkspaceId();
  if (workspaceId === undefined) throw new NoWorkspaceError();
  if (userIds.length === 0) return;
  await tx.insert(notification).values(userIds.map((userId) => ({ id: randomUUID(), workspaceId, userId, ...entry })));
}
