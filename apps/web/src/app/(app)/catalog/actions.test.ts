import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type DbHandle } from "@/db/client";
import { runInWorkspace } from "@/db/workspace";
import { startDatabase, type TestDatabase } from "@/test/postgres";

// Phase 2 plan Task 22: the catalog actions through action() on the real crm_app role.
let databaseUrl = "";
vi.mock("@/lib/env", () => ({ getEnv: () => ({ DATABASE_URL: databaseUrl }) }));
let signedIn: { userId: string; workspaceId: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: async () =>
    signedIn && { user: { id: signedIn.userId }, session: { activeOrganizationId: signedIn.workspaceId } },
}));

const { createServiceAction, setServiceArchivedAction, updateServiceAction } = await import("./actions");
const { listServices } = await import("@/db/catalog/services");

let database: TestDatabase;
let admin: postgres.Sql;
let app: DbHandle;

async function newWorkspace(): Promise<string> {
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('catalog', ${`catalog-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  await admin`insert into workspace_settings (workspace_id, country, default_currency) values (${org.id}, 'MY', 'MYR')`;
  return org.id;
}

async function signInAs(workspaceId: string, role: string): Promise<string> {
  const [user] = await admin<{ id: string }[]>`
    insert into "user" (name, email) values ('Member', ${`member-${randomUUID()}@example.test`}) returning id`;
  if (!user) throw new Error("user not created");
  await admin`insert into member (organization_id, user_id, role, created_at) values (${workspaceId}, ${user.id}, ${role}, now())`;
  signedIn = { userId: user.id, workspaceId };
  return user.id;
}

const typed = { name: "Design sprint", description: "Two days.\nOne workshop.", price: "1,234.50", currency: "MYR", unit: "day", taxable: true };

async function created(fields: Partial<typeof typed> = {}): Promise<{ id: string; version: number }> {
  const result = await createServiceAction({ ...typed, ...fields });
  if (!result.ok) throw new Error(`not created: ${result.status}`);
  return result.data;
}

const rowsOf = async (workspaceId: string) =>
  [...(await admin`select name, default_unit_price_minor::text as price, currency, archived_at is not null as archived, version
    from service where workspace_id = ${workspaceId} order by name`)];
const auditOf = async (workspaceId: string) =>
  [...(await admin`select action, actor_user_id, target_id, before, after from audit_log where workspace_id = ${workspaceId} order by created_at, action`)];
const listed = async (workspaceId: string, archived: boolean) =>
  (await runInWorkspace(app.db, workspaceId, (tx) => listServices(tx, { archived }))).map((row) => row.name);

beforeAll(async () => {
  database = await startDatabase();
  databaseUrl = database.appUrl;
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  app = createDb(database.appUrl, { max: 1 });
});

afterAll(async () => {
  const cache = globalThis as typeof globalThis & { crmDb?: { sql: { end(): Promise<void> } } };
  await cache.crmDb?.sql.end();
  cache.crmDb = undefined;
  await app?.sql.end();
  await admin?.end();
  await database?.stop();
});

describe("createServiceAction", () => {
  it.each(["owner", "admin"])("%s: stores the price as exact minor units, audited with the row after", async (role) => {
    const workspaceId = await newWorkspace();
    const actor = await signInAs(workspaceId, role);
    const { id } = await created();
    expect(await rowsOf(workspaceId)).toEqual([{ name: "Design sprint", price: "123450", currency: "MYR", archived: false, version: 1 }]);
    expect(await auditOf(workspaceId)).toEqual([
      {
        action: "service.created",
        actor_user_id: actor,
        target_id: id,
        before: null,
        after: {
          name: "Design sprint",
          default_description: "Two days.\nOne workshop.",
          // A decimal string of minor units, never a JSON number (MON-03).
          default_unit_price_minor: "123450",
          currency: "MYR",
          unit: "day",
          default_taxable: true,
          archived_at: null,
          version: 1,
        },
      },
    ]);
  });

  it.each([
    ["more decimals than MYR has (never rounded)", { price: "1.005" }, ["price"]],
    ["a decimal in JPY", { price: "1500.5", currency: "JPY" }, ["price"]],
    ["a negative price", { price: "-10" }, ["price"]],
    ["a price that is not a number", { price: "12abc" }, ["price"]],
    ["a price above the bound", { price: "10,000,000,000,000" }, ["price"]],
    ["a code outside ISO 4217", { currency: "XXX" }, ["currency"]],
    ["an empty name", { name: "  " }, ["name"]],
  ])("refuses %s with INVALID_INPUT and writes nothing", async (_, fields, paths) => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "admin");
    expect(await createServiceAction({ ...typed, ...fields })).toEqual({ ok: false, status: "INVALID_INPUT", fields: paths });
    expect(await rowsOf(workspaceId)).toEqual([]);
  });

  it("takes each currency's own exponent and no price at all", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "owner");
    await created({ name: "A", price: "1,500", currency: "JPY" });
    await created({ name: "B", price: "1.005", currency: "KWD" });
    await created({ name: "C", price: "", currency: "SGD" });
    expect((await rowsOf(workspaceId)).map(({ name, price, currency }) => [name, price, currency])).toEqual([
      ["A", "1500", "JPY"],
      ["B", "1005", "KWD"],
      ["C", null, "SGD"],
    ]);
  });
});

describe("updateServiceAction", () => {
  it("refuses a currency change while a default price is set, and allows it once the price is cleared", async () => {
    const workspaceId = await newWorkspace();
    const actor = await signInAs(workspaceId, "admin");
    const { id } = await created();
    const save = (version: number, fields: Partial<typeof typed>) => updateServiceAction({ id, expectedVersion: version, ...typed, ...fields });

    expect(await save(1, { currency: "SGD" })).toEqual({ ok: false, status: "CURRENCY_LOCKED" });
    // Not even in the same save that clears the price (spec: the price is cleared first).
    expect(await save(1, { currency: "SGD", price: "" })).toEqual({ ok: false, status: "CURRENCY_LOCKED" });
    expect(await rowsOf(workspaceId)).toMatchObject([{ price: "123450", currency: "MYR", version: 1 }]);

    expect(await save(1, { price: "" })).toEqual({ ok: true, status: "DONE", data: { id, version: 2 } });
    expect(await save(2, { price: "", currency: "SGD" })).toEqual({ ok: true, status: "DONE", data: { id, version: 3 } });
    expect(await save(3, { price: "99.90", currency: "SGD" })).toMatchObject({ ok: true });
    expect(await rowsOf(workspaceId)).toMatchObject([{ price: "9990", currency: "SGD", version: 4 }]);

    const updates = (await auditOf(workspaceId)).filter((entry) => entry.action === "service.updated");
    expect(updates.map(({ before, after }) => [before.default_unit_price_minor, before.currency, after.default_unit_price_minor, after.currency])).toEqual([
      ["123450", "MYR", null, "MYR"],
      [null, "MYR", null, "SGD"],
      [null, "SGD", "9990", "SGD"],
    ]);
    expect(updates.every((entry) => entry.actor_user_id === actor && entry.target_id === id)).toBe(true);
  });

  it("refuses a stale version with STALE_VERSION and keeps the stored row", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "owner");
    const { id } = await created();
    expect(await updateServiceAction({ id, expectedVersion: 1, ...typed, name: "First" })).toMatchObject({ ok: true });
    expect(await updateServiceAction({ id, expectedVersion: 1, ...typed, name: "Second" })).toEqual({ ok: false, status: "STALE_VERSION" });
    expect(await rowsOf(workspaceId)).toMatchObject([{ name: "First", version: 2 }]);
  });

  it("cannot reach another workspace's service: NOT_FOUND, and that row is unchanged", async () => {
    const workspaceA = await newWorkspace();
    await signInAs(workspaceA, "owner");
    const { id } = await created();
    const workspaceB = await newWorkspace();
    await signInAs(workspaceB, "owner");
    expect(await updateServiceAction({ id, expectedVersion: 1, ...typed, name: "Taken" })).toEqual({ ok: false, status: "NOT_FOUND" });
    expect(await setServiceArchivedAction({ id, expectedVersion: 1, archived: true })).toEqual({ ok: false, status: "NOT_FOUND" });
    expect(await rowsOf(workspaceA)).toMatchObject([{ name: "Design sprint", archived: false, version: 1 }]);
    expect(await listed(workspaceB, false)).toEqual([]);
  });
});

describe("setServiceArchivedAction", () => {
  it("archive hides the service from the default list; unarchive brings it back; both audited", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "admin");
    const { id } = await created();
    await created({ name: "Retainer" });
    expect(await listed(workspaceId, false)).toEqual(["Design sprint", "Retainer"]);

    expect(await setServiceArchivedAction({ id, expectedVersion: 1, archived: true })).toEqual({
      ok: true,
      status: "DONE",
      data: { id, version: 2, archived: true },
    });
    expect(await listed(workspaceId, false)).toEqual(["Retainer"]);
    expect(await listed(workspaceId, true)).toEqual(["Design sprint"]);

    expect(await setServiceArchivedAction({ id, expectedVersion: 2, archived: false })).toMatchObject({ ok: true, data: { archived: false } });
    expect(await listed(workspaceId, false)).toEqual(["Design sprint", "Retainer"]);
    expect(await listed(workspaceId, true)).toEqual([]);

    const entries = (await auditOf(workspaceId)).filter((entry) => entry.target_id === id && entry.action !== "service.created");
    expect(entries.map(({ action, before, after }) => [action, before.archived_at === null, after.archived_at === null])).toEqual([
      ["service.archived", true, false],
      ["service.unarchived", false, true],
    ]);
  });
});

describe("Staff", () => {
  it("are refused every catalog action with FORBIDDEN, and nothing is written", async () => {
    const workspaceId = await newWorkspace();
    await signInAs(workspaceId, "owner");
    const { id } = await created();
    await signInAs(workspaceId, "staff");
    expect(await createServiceAction({ ...typed, name: "Staff" })).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(await updateServiceAction({ id, expectedVersion: 1, ...typed, name: "Staff" })).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(await setServiceArchivedAction({ id, expectedVersion: 1, archived: true })).toEqual({ ok: false, status: "FORBIDDEN" });
    expect(await rowsOf(workspaceId)).toEqual([{ name: "Design sprint", price: "123450", currency: "MYR", archived: false, version: 1 }]);
    expect((await auditOf(workspaceId)).map((entry) => entry.action)).toEqual(["service.created"]);
  });
});
