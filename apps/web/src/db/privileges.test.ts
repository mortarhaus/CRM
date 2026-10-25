import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectivePrivileges, objectsNotOwnedBy, roleAttributes, roleMemberships } from "../test/catalog";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { EXPECTED_PRIVILEGES, type ManifestRole } from "./privileges";

let database: TestDatabase;
let admin: postgres.Sql;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await admin?.end();
  await database?.stop();
});

describe("effective privileges equal the manifest", () => {
  it.each(Object.keys(EXPECTED_PRIVILEGES) as ManifestRole[])("%s", async (role) => {
    expect(await effectivePrivileges(admin, role)).toEqual([...EXPECTED_PRIVILEGES[role]].sort());
  });
});

describe("roles", () => {
  it("has no superuser or BYPASSRLS role except the container's own admin", async () => {
    const rows = await admin<{ name: string }[]>`
      select rolname as name from pg_roles where rolsuper or rolbypassrls order by rolname`;
    expect(rows.map((row) => row.name)).toEqual([database.container.getUsername()]);
    expect((await roleAttributes(admin)).filter((role) => role.elevated)).toEqual([]);
  });

  it("lets no role become crm_purge, crm_app, crm_worker or crm_migrator", async () => {
    expect(await roleMemberships(admin)).toEqual([
      { role: "crm_link_resolver", member: "crm_migrator", admin: false, inherit: false, set: true },
    ]);
  });

  it("makes crm_migrator the owner of every table, sequence, function and schema it scans", async () => {
    expect(await objectsNotOwnedBy(admin, "crm_migrator")).toEqual([]);
    const [row] = await admin<{ owner: string }[]>`
      select pg_get_userbyid(datdba) as owner from pg_database where datname = current_database()`;
    expect(row?.owner).toBe("crm_migrator");
  });
});

// Proves the helper is not blind: a direct grant, a column grant and PUBLIC EXECUTE all show up,
// and a function crm_migrator creates after migration 0001 is not executable through PUBLIC.
describe("the privilege scan itself", () => {
  const scratch = ["scratch"];
  let migrator: postgres.Sql;

  beforeAll(async () => {
    migrator = postgres(database.migratorUrl, { max: 1, onnotice: () => {} });
    await migrator.unsafe("CREATE SCHEMA scratch");
    await migrator.unsafe("CREATE TABLE scratch.t (a int, b int)");
    await migrator.unsafe("CREATE FUNCTION scratch.by_migrator() RETURNS int LANGUAGE sql AS 'select 1'");
    await admin.unsafe("CREATE FUNCTION scratch.by_superuser() RETURNS int LANGUAGE sql AS 'select 1'");
  });

  afterAll(async () => {
    await admin.unsafe("DROP SCHEMA IF EXISTS scratch CASCADE");
    await migrator?.end();
  });

  it("reports a direct table grant", async () => {
    await migrator.unsafe("GRANT SELECT ON scratch.t TO crm_purge");
    expect(await effectivePrivileges(admin, "crm_purge", scratch)).toContain("table:scratch.t:SELECT");
  });

  it("reports a column grant without the table privilege", async () => {
    await migrator.unsafe("GRANT UPDATE (b) ON scratch.t TO crm_worker");
    const privileges = await effectivePrivileges(admin, "crm_worker", scratch);
    expect(privileges).toContain("column:scratch.t.b:UPDATE");
    expect(privileges).not.toContain("column:scratch.t.a:UPDATE");
  });

  it("counts EXECUTE that comes through PUBLIC, and migration 0001 keeps it off crm_migrator's functions", async () => {
    await migrator.unsafe("GRANT USAGE ON SCHEMA scratch TO PUBLIC");
    for (const role of ["PUBLIC", "crm_link_resolver"]) {
      const privileges = await effectivePrivileges(admin, role, scratch);
      expect(privileges).toContain("function:scratch.by_superuser():EXECUTE");
      expect(privileges).not.toContain("function:scratch.by_migrator():EXECUTE");
    }
  });
});
