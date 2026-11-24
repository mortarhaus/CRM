import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sqlState, startDatabase, type TestDatabase } from "../../test/postgres";
import { createDb, type DbHandle } from "../client";
import { runInWorkspace } from "../workspace";

// Phase 2 plan Task 21: the service table's own rules, as crm_app with no application code in the way. The action
// refuses a currency change first; these show that no other path can make one (spec Money rules "Service currency
// edit"), that no row can be deleted (plan Q22), and the CHECKs.
let database: TestDatabase;
let admin: postgres.Sql;
let app: DbHandle;
let workspaceId: string;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  app = createDb(database.appUrl, { max: 1 });
  const [org] = await admin<{ id: string }[]>`
    insert into organization (name, slug, created_at) values ('catalog', ${`catalog-${randomUUID()}`}, now()) returning id`;
  if (!org) throw new Error("workspace not created");
  workspaceId = org.id;
});

afterAll(async () => {
  await app?.sql.end();
  await admin?.end();
  await database?.stop();
});

const asApp = <T>(statement: ReturnType<typeof sql>) => runInWorkspace(app.db, workspaceId, (tx) => tx.execute<T & Record<string, unknown>>(statement));

const insert = (name: string, currency: string, price: bigint | null) => sql`
  insert into service (workspace_id, name, currency, default_unit_price_minor, default_taxable)
  values (${workspaceId}, ${name}, ${currency}, ${price}, false) returning id`;

async function newService(price: bigint | null): Promise<string> {
  const [row] = await asApp<{ id: string }>(insert("Design", "MYR", price));
  if (!row) throw new Error("service not created");
  return row.id;
}

// The SQLSTATE and constraint of a refused statement.
async function refusal(statement: ReturnType<typeof sql>): Promise<{ code: string; constraint: string | undefined }> {
  try {
    await asApp(statement);
  } catch (error) {
    const cause = (error as { cause?: { code?: string; constraint_name?: string } }).cause ?? (error as { code?: string; constraint_name?: string });
    return { code: String(cause.code), constraint: cause.constraint_name };
  }
  throw new Error("statement was not refused");
}

describe("service, as crm_app", () => {
  it("refuses a currency change while a default price is set (trigger service_currency_locked, 23514)", async () => {
    const id = await newService(150_000n);
    expect(await refusal(sql`update service set currency = 'SGD' where id = ${id}`)).toEqual({
      code: "23514",
      constraint: "service_currency_locked",
    });
    // Clearing the price in the same statement does not get round it: the stored row has a price.
    expect(await refusal(sql`update service set currency = 'SGD', default_unit_price_minor = null where id = ${id}`)).toMatchObject({
      code: "23514",
      constraint: "service_currency_locked",
    });
    // Other columns, and the same currency written again, are fine.
    await asApp(sql`update service set name = 'Design sprint', currency = 'MYR' where id = ${id}`);
    // Once the price is cleared (a save of its own), the currency can change.
    await asApp(sql`update service set default_unit_price_minor = null where id = ${id}`);
    await asApp(sql`update service set currency = 'SGD' where id = ${id}`);
    const [row] = await admin`select currency, default_unit_price_minor from service where id = ${id}`;
    expect(row).toEqual({ currency: "SGD", default_unit_price_minor: null });
  });

  it("deletes nothing: no DELETE grant (42501)", async () => {
    const id = await newService(null);
    expect(await sqlState(asApp(sql`delete from service where id = ${id}`))).toBe("42501");
    expect(await admin`select 1 from service where id = ${id}`).toHaveLength(1);
  });

  it.each([
    ["a negative price", () => insert("X", "MYR", -1n), "service_default_unit_price_minor_check"],
    ["a price over MONEY_MAX_MINOR", () => insert("X", "MYR", 1_000_000_000_000_000n), "service_default_unit_price_minor_check"],
    ["a code outside ISO 4217", () => insert("X", "XXX", null), "service_currency_check"],
    ["an empty name", () => insert("", "MYR", null), "service_name_check"],
  ])("refuses %s (CHECK, 23514)", async (_, statement, constraint) => {
    expect(await refusal(statement())).toEqual({ code: "23514", constraint });
  });

  it("cannot change the id, workspace_id or created_at (no column grant, 42501)", async () => {
    const id = await newService(null);
    for (const column of ["id", "workspace_id", "created_at"]) {
      expect(await sqlState(asApp(sql`update service set ${sql.identifier(column)} = ${sql.identifier(column)} where id = ${id}`))).toBe("42501");
    }
  });
});
