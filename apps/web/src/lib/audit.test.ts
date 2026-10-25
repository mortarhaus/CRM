import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type DbHandle } from "../db/client";
import { NoWorkspaceError, runInWorkspace, type Tx } from "../db/workspace";
import { sqlState, startDatabase, type TestDatabase } from "../test/postgres";
import { recordAudit } from "./audit";

let database: TestDatabase;
let admin: postgres.Sql;
let handle: DbHandle;
let workspaceA: string;
let actorId: string;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl, { max: 1 });
  const [actor] = await admin<{ id: string }[]>`
    insert into "user" (name, email, email_verified, created_at, updated_at)
    values ('Audit actor', ${`actor-${randomUUID()}@example.test`}, false, now(), now()) returning id`;
  const [workspace] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('audit-a', ${`audit-a-${randomUUID()}`}, now()) returning id`;
  if (!actor || !workspace) throw new Error("fixtures not created");
  actorId = actor.id;
  workspaceA = workspace.id;
});

afterAll(async () => {
  await handle?.sql.end();
  await admin?.end();
  await database?.stop();
});

describe("recordAudit", () => {
  it("stores the entry in the transaction's workspace, with every listed PII field redacted in before and after", async () => {
    const targetId = randomUUID();
    await runInWorkspace(handle.db, workspaceA, (tx) =>
      recordAudit(tx, {
        actorUserId: actorId,
        action: "customer.updated",
        targetType: "customer",
        targetId,
        before: { email: "old@example.test", name: "Kept", amount: 5 },
        after: { email: "new@example.test", name: "Kept", amount: 6 },
        piiFields: ["email"],
        ip: "203.0.113.7",
      }),
    );
    const rows = await admin`
      select workspace_id, actor_user_id, action, target_type, target_id, before, after, ip
      from audit_log where target_id = ${targetId}`;
    expect(rows).toEqual([
      {
        workspace_id: workspaceA,
        actor_user_id: actorId,
        action: "customer.updated",
        target_type: "customer",
        target_id: targetId,
        before: { email: "[pii]", name: "Kept", amount: 5 },
        after: { email: "[pii]", name: "Kept", amount: 6 },
        ip: "203.0.113.7",
      },
    ]);
  });

  it("stores null before, after, target and ip when they are not given", async () => {
    const action = `system.${randomUUID()}`;
    await runInWorkspace(handle.db, workspaceA, (tx) =>
      recordAudit(tx, { actorUserId: null, action, targetType: "workspace", targetId: null }),
    );
    const rows = await admin`select actor_user_id, target_id, before, after, ip from audit_log where action = ${action}`;
    expect(rows).toEqual([{ actor_user_id: null, target_id: null, before: null, after: null, ip: null }]);
  });

  it("throws NoWorkspaceError outside runInWorkspace, before any SQL", async () => {
    const execute = vi.fn();
    const insert = vi.fn();
    const fake = { execute, insert } as unknown as Tx;
    await expect(recordAudit(fake, { actorUserId: null, action: "x", targetType: "y", targetId: null })).rejects.toBeInstanceOf(
      NoWorkspaceError,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws NoWorkspaceError in a plain transaction, and writes nothing", async () => {
    const action = `plain.${randomUUID()}`;
    await expect(
      handle.db.transaction((tx) => recordAudit(tx, { actorUserId: null, action, targetType: "y", targetId: null })),
    ).rejects.toBeInstanceOf(NoWorkspaceError);
    expect(await admin`select 1 from audit_log where action = ${action}`).toHaveLength(0);
  });

  it("cannot be changed or removed by crm_app (42501)", async () => {
    expect(
      await sqlState(runInWorkspace(handle.db, workspaceA, (tx) => tx.execute(sql`update audit_log set action = 'changed'`))),
    ).toBe("42501");
    expect(await sqlState(runInWorkspace(handle.db, workspaceA, (tx) => tx.execute(sql`delete from audit_log`)))).toBe("42501");
  });
});
