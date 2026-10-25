import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { holdsCommand, tenantTables } from "../test/catalog";
import { sqlState, startDatabase, type TestDatabase } from "../test/postgres";
import { createDb, type DbHandle } from "./client";
import { EXPECTED_PRIVILEGES } from "./privileges";
import { organization, workspaceSettings } from "./schema";
import { runInWorkspace, type Tx } from "./workspace";

// TEN-08: every tenant table gets read and write isolation tests over two workspaces, as crm_app.
// `update` and `delete` change the rows of the given workspace and return the number of rows changed;
// each is required exactly when crm_app holds that command on the table.
interface TenantFixture {
  seed(tx: Tx, workspaceId: string): Promise<void>;
  update?(tx: Tx, workspaceId: string): Promise<number>;
  delete?(tx: Tx, workspaceId: string): Promise<number>;
}

const TENANT_FIXTURES: Record<string, TenantFixture> = {
  workspace_settings: {
    async seed(tx, workspaceId) {
      await tx.insert(workspaceSettings).values({ workspaceId });
    },
    async update(tx, workspaceId) {
      const result = await tx
        .update(workspaceSettings)
        .set({ version: sql`${workspaceSettings.version} + 1` })
        .where(eq(workspaceSettings.workspaceId, workspaceId));
      return result.count;
    },
  },
};

let database: TestDatabase;
let admin: postgres.Sql;
// One server connection, so the bare queries run on a connection that earlier workspace transactions used.
let handle: DbHandle;
let workspaceA: string;
let workspaceB: string;

async function createWorkspace(name: string): Promise<string> {
  const [row] = await handle.db
    .insert(organization)
    .values({ name, slug: `${name}-${randomUUID()}`, createdAt: new Date() })
    .returning({ id: organization.id });
  if (!row) throw new Error("workspace not created");
  return row.id;
}

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl, { max: 1 });
  workspaceA = await createWorkspace("isolation-a");
  workspaceB = await createWorkspace("isolation-b");
});

afterAll(async () => {
  await handle?.sql.end();
  await admin?.end();
  await database?.stop();
});

describe("the isolation harness", () => {
  it("has a fixture for every tenant table, and none for any other table", async () => {
    const tables = await tenantTables(admin);
    expect([
      ...tables.filter((table) => !(table in TENANT_FIXTURES)).map((table) => `no isolation fixture for ${table} (TEN-08)`),
      ...Object.keys(TENANT_FIXTURES)
        .filter((table) => !tables.includes(table))
        .map((table) => `isolation fixture for ${table}, which is not a tenant table`),
    ]).toEqual([]);
  });

  it.each(Object.keys(TENANT_FIXTURES))("%s has an update and a delete fixture exactly where crm_app holds them", (table) => {
    const fixture = TENANT_FIXTURES[table];
    expect({ update: fixture?.update !== undefined, delete: fixture?.delete !== undefined }).toEqual({
      update: holdsCommand(EXPECTED_PRIVILEGES, "crm_app", "public", table, "UPDATE"),
      delete: holdsCommand(EXPECTED_PRIVILEGES, "crm_app", "public", table, "DELETE"),
    });
  });
});

describe.each(Object.entries(TENANT_FIXTURES))("%s, as crm_app over two workspaces", (table, fixture) => {
  const target = sql.identifier(table);
  let crossInsertState: string | undefined;

  const count = async (workspaceId: string) => {
    const [row] = await admin<{ count: number }[]>`
      select count(*)::int as count from ${admin(table)} where workspace_id = ${workspaceId}`;
    return row?.count ?? 0;
  };

  beforeAll(async () => {
    await runInWorkspace(handle.db, workspaceA, (tx) => fixture.seed(tx, workspaceA));
    // Before B is seeded, so a key on workspace_id alone cannot turn the refusal into a conflict.
    crossInsertState = await sqlState(runInWorkspace(handle.db, workspaceA, (tx) => fixture.seed(tx, workspaceB)));
    await runInWorkspace(handle.db, workspaceB, (tx) => fixture.seed(tx, workspaceB));
  });

  it("refuses to insert a row for workspace B inside workspace A (42501)", async () => {
    expect(crossInsertState).toBe("42501");
    expect(await count(workspaceB)).toBe(1);
  });

  it("shows workspace A only its own rows", async () => {
    const rows = await runInWorkspace(handle.db, workspaceA, (tx) =>
      tx.execute<{ workspace_id: string }>(sql`select workspace_id from ${target}`),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.workspace_id))).toEqual(new Set([workspaceA]));
  });

  it("returns 0 rows to a bare query on a reused connection while both workspaces have rows (R1)", async () => {
    expect(await count(workspaceA)).toBeGreaterThan(0);
    expect(await count(workspaceB)).toBeGreaterThan(0);
    const [row] = await handle.db.execute<{ count: number }>(sql`select count(*)::int as count from ${target}`);
    expect(row?.count).toBe(0);
  });

  it("updates no row of workspace B from workspace A, and its own rows only", async () => {
    if (!fixture.update) {
      expect(
        await sqlState(
          runInWorkspace(handle.db, workspaceA, (tx) => tx.execute(sql`update ${target} set workspace_id = workspace_id`)),
        ),
      ).toBe("42501");
      return;
    }
    const update = fixture.update;
    expect(await runInWorkspace(handle.db, workspaceA, (tx) => update(tx, workspaceB))).toBe(0);
    expect(await runInWorkspace(handle.db, workspaceA, (tx) => update(tx, workspaceA))).toBeGreaterThan(0);
  });

  it("deletes no row of workspace B from workspace A, and its own rows only", async () => {
    if (!fixture.delete) {
      expect(
        await sqlState(runInWorkspace(handle.db, workspaceA, (tx) => tx.execute(sql`delete from ${target}`))),
      ).toBe("42501");
      expect(await count(workspaceA)).toBeGreaterThan(0);
      return;
    }
    const remove = fixture.delete;
    expect(await runInWorkspace(handle.db, workspaceA, (tx) => remove(tx, workspaceB))).toBe(0);
    expect(await count(workspaceB)).toBeGreaterThan(0);
    expect(await runInWorkspace(handle.db, workspaceA, (tx) => remove(tx, workspaceA))).toBeGreaterThan(0);
  });
});
