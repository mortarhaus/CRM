import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./client";
import { getDb } from "./index";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class InvalidWorkspaceIdError extends Error {
  constructor() {
    super("Workspace id must be a uuid");
    this.name = "InvalidWorkspaceIdError";
  }
}

export class NestedWorkspaceError extends Error {
  constructor() {
    super("A workspace transaction cannot run inside another one");
    this.name = "NestedWorkspaceError";
  }
}

export class NoWorkspaceError extends Error {
  constructor() {
    super("This needs a workspace transaction (runInWorkspace or withWorkspace)");
    this.name = "NoWorkspaceError";
  }
}

const activeWorkspace = new AsyncLocalStorage<string>();

// The workspace of the runInWorkspace transaction this code runs in, or undefined outside one.
export function currentWorkspaceId(): string | undefined {
  return activeWorkspace.getStore();
}

// The only place the workspace context is set (TEN-09): bound and transaction-local, so it never outlives
// the transaction on a pooled connection. Policies read it through nullif (spec Tenancy, Known risk R1).
export async function runInWorkspace<T>(db: Database, workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!z.uuid().safeParse(workspaceId).success) throw new InvalidWorkspaceIdError();
  if (activeWorkspace.getStore() !== undefined) throw new NestedWorkspaceError();
  return activeWorkspace.run(workspaceId, () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`);
      return fn(tx);
    }),
  );
}

export function withWorkspace<T>(workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runInWorkspace(getDb().db, workspaceId, fn);
}
