import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compositeFkViolations, tenantTables } from "../test/catalog";
import { startDatabase, type TestDatabase } from "../test/postgres";

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

describe("composite workspace foreign keys (spec Tenancy)", () => {
  it("every FK between two tenant tables in public is composite on workspace_id", async () => {
    expect(await tenantTables(admin)).toContain("workspace_settings");
    expect(await compositeFkViolations(admin)).toEqual([]);
  });

  // Phase 1 has no FK between two tenant tables, so the rule is proved on scratch fixtures.
  describe("self-test on scratch fixtures", () => {
    beforeAll(async () => {
      await admin.unsafe(`
        CREATE SCHEMA scratch;
        CREATE TABLE scratch.parent (workspace_id uuid NOT NULL, id uuid NOT NULL, PRIMARY KEY (id), UNIQUE (workspace_id, id), UNIQUE (id, workspace_id));
        CREATE TABLE scratch.child (workspace_id uuid NOT NULL, id uuid PRIMARY KEY, parent_id uuid NOT NULL);`);
    });

    afterAll(async () => {
      await admin.unsafe("DROP SCHEMA IF EXISTS scratch CASCADE");
    });

    async function withForeignKey(definition: string): Promise<string[]> {
      await admin.unsafe(`ALTER TABLE scratch.child ADD CONSTRAINT child_parent ${definition}`);
      try {
        return await compositeFkViolations(admin, "scratch");
      } finally {
        await admin.unsafe("ALTER TABLE scratch.child DROP CONSTRAINT child_parent");
      }
    }

    const reported = ["scratch.child.child_parent -> scratch.parent: not composite on workspace_id"];

    it("reports a single-column FK", async () => {
      expect(await withForeignKey("FOREIGN KEY (parent_id) REFERENCES scratch.parent (id)")).toEqual(reported);
    });

    it("reports a composite FK whose workspace_id columns are at different positions", async () => {
      expect(
        await withForeignKey("FOREIGN KEY (workspace_id, parent_id) REFERENCES scratch.parent (id, workspace_id)"),
      ).toEqual(reported);
    });

    it("reports a composite FK that pairs workspace_id with another column", async () => {
      expect(
        await withForeignKey("FOREIGN KEY (parent_id, workspace_id) REFERENCES scratch.parent (workspace_id, id)"),
      ).toEqual(reported);
    });

    it("accepts (workspace_id, parent_id) -> (workspace_id, id)", async () => {
      expect(
        await withForeignKey("FOREIGN KEY (workspace_id, parent_id) REFERENCES scratch.parent (workspace_id, id)"),
      ).toEqual([]);
    });

    it("leaves FKs to the system tables outside the rule", async () => {
      expect(await withForeignKey('FOREIGN KEY (workspace_id) REFERENCES public.organization (id)')).toEqual([]);
    });
  });
});
