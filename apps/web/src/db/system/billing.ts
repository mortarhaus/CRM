import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { billingAccount } from "../schema";

// The user's billing account, created on their first workspace (one per owner in Part 1). Better Auth
// writes the organization in its own statement afterwards, so this is idempotent (plan Risk 6).
export async function ensureBillingAccount(db: Database, ownerUserId: string, name: string): Promise<string> {
  const [created] = await db
    .insert(billingAccount)
    .values({ ownerUserId, name })
    .onConflictDoNothing({ target: billingAccount.ownerUserId })
    .returning({ id: billingAccount.id });
  if (created) return created.id;
  const [existing] = await db
    .select({ id: billingAccount.id })
    .from(billingAccount)
    .where(eq(billingAccount.ownerUserId, ownerUserId));
  if (!existing) throw new Error("billing account not found after insert");
  return existing.id;
}
