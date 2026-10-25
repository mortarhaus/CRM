import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WORKSPACE_PREDICATE } from "../test/catalog";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { createDb, type DbHandle } from "./client";
import { InvalidWorkspaceIdError, NestedWorkspaceError, runInWorkspace, type Tx } from "./workspace";

const A = randomUUID();
const B = randomUUID();

let database: TestDatabase;
let admin: postgres.Sql;
// One server connection, so every transaction below reuses the connection the previous one ran on.
let handle: DbHandle;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`
    CREATE SCHEMA scratch;
    GRANT USAGE ON SCHEMA scratch TO crm_app;
    CREATE TABLE scratch.items (workspace_id uuid not null, label text not null);
    ALTER TABLE scratch.items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE scratch.items FORCE ROW LEVEL SECURITY;
    CREATE POLICY items_workspace ON scratch.items AS RESTRICTIVE FOR ALL TO crm_app, crm_purge
      USING (${WORKSPACE_PREDICATE}) WITH CHECK (${WORKSPACE_PREDICATE});
    CREATE POLICY items_app_select ON scratch.items FOR SELECT TO crm_app USING (${WORKSPACE_PREDICATE});
    CREATE POLICY items_app_insert ON scratch.items FOR INSERT TO crm_app WITH CHECK (${WORKSPACE_PREDICATE});
    GRANT SELECT, INSERT ON scratch.items TO crm_app;
    -- Control: the same table with a policy that casts the setting without nullif (Known risk R1).
    CREATE TABLE scratch.items_without_nullif (workspace_id uuid not null);
    ALTER TABLE scratch.items_without_nullif ENABLE ROW LEVEL SECURITY;
    ALTER TABLE scratch.items_without_nullif FORCE ROW LEVEL SECURITY;
    CREATE POLICY items_without_nullif_select ON scratch.items_without_nullif FOR SELECT TO crm_app
      USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
    GRANT SELECT ON scratch.items_without_nullif TO crm_app;
  `);
  // Seeded as the superuser, which RLS does not apply to: rows exist in both workspaces.
  await admin`insert into scratch.items ${admin([
    { workspace_id: A, label: "a1" },
    { workspace_id: A, label: "a2" },
    { workspace_id: B, label: "b1" },
  ])}`;
  await admin`insert into scratch.items_without_nullif values (${A}), (${B})`;
  handle = createDb(database.appUrl, { max: 1 });
});

afterAll(async () => {
  await handle?.sql.end();
  await admin?.end();
  await database?.stop();
});

type Executor = Pick<Tx, "execute">;

async function connectionState(executor: Executor) {
  const [row] = await executor.execute<{ pid: number; setting: string | null }>(
    sql`select pg_backend_pid() as pid, current_setting('app.workspace_id', true) as setting`,
  );
  return row;
}

async function workspacesSeen(executor: Executor): Promise<string[]> {
  const rows = await executor.execute<{ workspace_id: string }>(sql`select workspace_id from scratch.items order by label`);
  return rows.map((row) => row.workspace_id);
}

async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    // drizzle-orm wraps the driver error; postgres.js puts the SQLSTATE on `code`.
    const { code, cause } = error as { code?: string; cause?: { code?: string } };
    return cause?.code ?? code;
  }
}

async function expectCleanReusedConnection(pid: number | undefined): Promise<void> {
  const after = await connectionState(handle.db);
  expect(after?.pid).toBe(pid);
  expect(after?.setting).toBe("");
  expect(await workspacesSeen(handle.db)).toEqual([]);
  // The control proves the connection is in the state Known risk R1 describes: without nullif it fails.
  expect(await sqlState(handle.db.execute(sql`select * from scratch.items_without_nullif`))).toBe("22P02");
}

describe("runInWorkspace", () => {
  it("sets the workspace for the transaction and shows only that workspace's rows", async () => {
    const inside = await runInWorkspace(handle.db, A, async (tx) => ({
      state: await connectionState(tx),
      seen: await workspacesSeen(tx),
    }));
    expect(inside.state?.setting).toBe(A);
    expect(inside.seen).toEqual([A, A]);
  });

  it("leaves no workspace on the reused connection after commit: a bare query sees 0 rows, without 22P02", async () => {
    const inside = await runInWorkspace(handle.db, A, (tx) => connectionState(tx));
    await expectCleanReusedConnection(inside?.pid);
  });

  it("leaves no workspace on the reused connection after a rollback", async () => {
    let pid: number | undefined;
    await expect(
      runInWorkspace(handle.db, A, async (tx) => {
        pid = (await connectionState(tx))?.pid;
        throw new Error("roll back");
      }),
    ).rejects.toThrow("roll back");
    await expectCleanReusedConnection(pid);
  });

  it("refuses to insert another workspace's row (WITH CHECK, 42501)", async () => {
    const insertB = runInWorkspace(handle.db, A, (tx) =>
      tx.execute(sql`insert into scratch.items (workspace_id, label) values (${B}, 'b-from-a')`),
    );
    expect(await sqlState(insertB)).toBe("42501");
    const [row] = await admin<{ count: number }[]>`select count(*)::int as count from scratch.items where label = 'b-from-a'`;
    expect(row?.count).toBe(0);
  });

  it("rejects an id that is not a uuid before any SQL runs", async () => {
    const transaction = vi.spyOn(handle.db, "transaction");
    try {
      await expect(runInWorkspace(handle.db, "not-a-uuid", async () => "ran")).rejects.toBeInstanceOf(
        InvalidWorkspaceIdError,
      );
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });

  it("refuses a workspace transaction inside another one, so a transaction never mixes two workspaces", async () => {
    await expect(
      runInWorkspace(handle.db, A, async (tx) => {
        await tx.execute(sql`insert into scratch.items (workspace_id, label) values (${A}, 'outer')`);
        return runInWorkspace(handle.db, B, () => Promise.resolve("inner ran"));
      }),
    ).rejects.toBeInstanceOf(NestedWorkspaceError);
    const [row] = await admin<{ count: number }[]>`select count(*)::int as count from scratch.items where label = 'outer'`;
    expect(row?.count).toBe(0);
    expect(await runInWorkspace(handle.db, B, (tx) => workspacesSeen(tx))).toEqual([B]);
  });
});
