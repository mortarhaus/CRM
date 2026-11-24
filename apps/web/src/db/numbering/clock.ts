import { sql } from "drizzle-orm";
import type { Tx } from "../workspace";

// Where the numbering code reads the time. It is read after the doc_sequence row lock is granted, never before (Bob
// PR #72 R1 P1): a time taken before the lock can belong to a period another issue has already left.
export type Clock = (tx: Tx) => Promise<Date>;

// The database's clock: one clock for every app instance. clock_timestamp() is the instant of the call; now() would
// be the start of the transaction, which can be before the lock was granted.
export const databaseClock: Clock = async (tx) => {
  const [row] = await tx.execute<{ ms: number }>(sql`select (extract(epoch from clock_timestamp()) * 1000)::float8 as ms`);
  if (row === undefined) throw new Error("clock_timestamp() returned no row");
  return new Date(Number(row.ms));
};
