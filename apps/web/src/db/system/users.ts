import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../index";
import { user } from "../schema";

// The user's sign-in address, for the worker's email.send handler (plan Task 27): job data carries the user id only,
// so the address is read when the email is sent. An id that is not a uuid, or no such user, is null.
export async function getUserEmail(userId: string): Promise<string | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const [row] = await getDb().db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  return row?.email ?? null;
}

// The user's name and sign-in address, for the owner email on a bank-details change (plan Task 16): read at send time,
// as getUserEmail. An id that is not a uuid, or no such user, is null.
export async function getUserContact(userId: string): Promise<{ name: string; email: string } | null> {
  if (!z.uuid().safeParse(userId).success) return null;
  const [row] = await getDb()
    .db.select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row ?? null;
}
