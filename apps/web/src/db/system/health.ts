import { getDb } from "../index";

export async function pingDatabase(): Promise<void> {
  await getDb().sql`select 1`;
}
