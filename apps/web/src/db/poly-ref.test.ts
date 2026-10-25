import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WORKSPACE_PREDICATE } from "../test/catalog";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { createDb, type DbHandle } from "./client";
import { runInWorkspace, type Tx } from "./workspace";

// Plan Task 11 and Settled item 3: the two polymorphic-reference trigger functions of migration 0006, tested on
// test-only fixture tables in schema scratch (never created by a migration). Each table that uses them later
// attaches them in its own migration and ships its per-reference tests (spec Tenancy, revision 8).
interface Failure {
  code?: string;
  message?: string;
}

let database: TestDatabase;
let admin: postgres.Sql;
let handle: DbHandle;
const A = randomUUID();
const B = randomUUID();
const targetA = { inA: randomUUID(), inB: randomUUID(), alsoInA: randomUUID() };
const targetB = { inA: randomUUID(), inB: randomUUID() };

async function failure(run: Promise<unknown>): Promise<Failure | undefined> {
  try {
    await run;
    return undefined;
  } catch (error) {
    const { code, message, cause } = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    return cause?.code ? { code: cause.code, message: cause.message } : { code, message };
  }
}

const IMMUTABLE = { code: "23514", message: "poly_ref: target is immutable" };
const NOT_IN_WORKSPACE = { code: "23503", message: "poly_ref: target not in workspace" };

function inWorkspace<T>(workspaceId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runInWorkspace(handle.db, workspaceId, fn);
}

function policyTemplate(table: string, commands: readonly string[]): string {
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`,
    `CREATE POLICY workspace ON ${table} AS RESTRICTIVE FOR ALL TO crm_app USING (${WORKSPACE_PREDICATE}) WITH CHECK (${WORKSPACE_PREDICATE})`,
    ...commands.map((command) => {
      const clause = command === "INSERT" ? `WITH CHECK (${WORKSPACE_PREDICATE})` : `USING (${WORKSPACE_PREDICATE})`;
      return `CREATE POLICY app_${command.toLowerCase()} ON ${table} AS PERMISSIVE FOR ${command} TO crm_app ${clause}`;
    }),
    `GRANT ${commands.join(", ")} ON ${table} TO crm_app`,
  ]
    .map((statement) => `${statement};`)
    .join("\n");
}

const INSERT_TRIGGER = (table: string) =>
  `CREATE TRIGGER poly_insert BEFORE INSERT ON ${table} FOR EACH ROW
     EXECUTE FUNCTION public.poly_ref_check_insert('target_type', 'target_id', 'a=scratch.target_a', 'b=scratch.target_b');`;
const RETARGET_TRIGGER = (table: string) =>
  `CREATE TRIGGER poly_retarget BEFORE UPDATE ON ${table} FOR EACH ROW
     EXECUTE FUNCTION public.poly_ref_forbid_retarget('workspace_id', 'target_type', 'target_id');`;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  handle = createDb(database.appUrl);
  const refColumns = "workspace_id uuid NOT NULL, id uuid PRIMARY KEY, target_type text NOT NULL, target_id uuid NOT NULL, note text";
  await admin.unsafe(`
    CREATE SCHEMA scratch;
    GRANT USAGE ON SCHEMA scratch TO crm_app;
    CREATE TABLE scratch.target_a (workspace_id uuid NOT NULL, id uuid PRIMARY KEY, UNIQUE (workspace_id, id));
    CREATE TABLE scratch.target_b (workspace_id uuid NOT NULL, id uuid PRIMARY KEY, UNIQUE (workspace_id, id));
    ${policyTemplate("scratch.target_a", ["SELECT"])}
    ${policyTemplate("scratch.target_b", ["SELECT"])}
    CREATE TABLE scratch.ref (${refColumns});
    ${policyTemplate("scratch.ref", ["SELECT", "INSERT", "UPDATE"])}
    ${INSERT_TRIGGER("scratch.ref")}
    ${RETARGET_TRIGGER("scratch.ref")}
    CREATE TABLE scratch.ref_ao (${refColumns});
    ${policyTemplate("scratch.ref_ao", ["SELECT", "INSERT"])}
    ${INSERT_TRIGGER("scratch.ref_ao")}
    ${RETARGET_TRIGGER("scratch.ref_ao")}
    CREATE TABLE scratch.retention (
      workspace_id uuid NOT NULL, qv_id uuid NULL, psv_id uuid NULL, source_type text NOT NULL, source_id uuid NOT NULL,
      CHECK (num_nonnulls(qv_id, psv_id) = 1));
    CREATE UNIQUE INDEX retention_qv ON scratch.retention (workspace_id, qv_id, source_type, source_id) WHERE qv_id IS NOT NULL;
    CREATE UNIQUE INDEX retention_psv ON scratch.retention (workspace_id, psv_id, source_type, source_id) WHERE psv_id IS NOT NULL;
    ${policyTemplate("scratch.retention", ["SELECT", "INSERT"])}`);
  await admin`insert into scratch.target_a (workspace_id, id) values
    (${A}, ${targetA.inA}), (${B}, ${targetA.inB}), (${A}, ${targetA.alsoInA})`;
  await admin`insert into scratch.target_b (workspace_id, id) values (${A}, ${targetB.inA}), (${B}, ${targetB.inB})`;
});

afterAll(async () => {
  await admin?.unsafe("DROP SCHEMA IF EXISTS scratch CASCADE");
  await admin?.end();
  await handle?.sql.end();
  await database?.stop();
});

function insertRef(tx: Tx, table: "ref" | "ref_ao", row: { workspaceId: string; type: string; targetId: string }) {
  const id = randomUUID();
  return tx
    .execute(
      sql`insert into ${sql.raw(`scratch.${table}`)} (workspace_id, id, target_type, target_id, note)
          values (${row.workspaceId}, ${id}, ${row.type}, ${row.targetId}, 'first')`,
    )
    .then(() => id);
}

describe("poly_ref_check_insert (spec Tenancy: polymorphic references)", () => {
  it("accepts a target in the same workspace, for each target type", async () => {
    await inWorkspace(A, async (tx) => {
      await insertRef(tx, "ref", { workspaceId: A, type: "a", targetId: targetA.inA });
      await insertRef(tx, "ref", { workspaceId: A, type: "b", targetId: targetB.inA });
    });
  });

  it("rejects another workspace's target, named by its id (SECURITY INVOKER: hidden by RLS and not in A)", async () => {
    for (const [type, targetId] of [
      ["a", targetA.inB],
      ["b", targetB.inB],
    ] as const) {
      expect(await failure(inWorkspace(A, (tx) => insertRef(tx, "ref", { workspaceId: A, type, targetId })))).toEqual(
        NOT_IN_WORKSPACE,
      );
    }
  });

  it("rejects a target of the wrong type and a target that does not exist", async () => {
    expect(
      await failure(inWorkspace(A, (tx) => insertRef(tx, "ref", { workspaceId: A, type: "b", targetId: targetA.inA }))),
    ).toEqual(NOT_IN_WORKSPACE);
    expect(
      await failure(inWorkspace(A, (tx) => insertRef(tx, "ref", { workspaceId: A, type: "a", targetId: randomUUID() }))),
    ).toEqual(NOT_IN_WORKSPACE);
  });

  it("rejects an unknown target type", async () => {
    expect(
      await failure(inWorkspace(A, (tx) => insertRef(tx, "ref", { workspaceId: A, type: "c", targetId: targetA.inA }))),
    ).toEqual({ code: "23514", message: "poly_ref: unknown target type" });
  });

  it("rejects another workspace's target through the superuser connection too (the trigger, not only RLS)", async () => {
    expect(
      await failure(
        admin`insert into scratch.ref (workspace_id, id, target_type, target_id) values (${A}, ${randomUUID()}, 'a', ${targetA.inB})`,
      ),
    ).toEqual(NOT_IN_WORKSPACE);
  });
});

describe("poly_ref_forbid_retarget", () => {
  let refId: string;

  beforeEach(async () => {
    refId = await inWorkspace(A, (tx) => insertRef(tx, "ref", { workspaceId: A, type: "a", targetId: targetA.inA }));
  });

  const update = (assignment: ReturnType<typeof sql>) =>
    inWorkspace(A, (tx) => tx.execute(sql`update scratch.ref set ${assignment} where id = ${refId}`));

  it.each([
    ["target_id to a same-workspace row", () => sql`target_id = ${targetA.alsoInA}`],
    ["target_id to another workspace's row", () => sql`target_id = ${targetA.inB}`],
    ["target_type", () => sql`target_type = 'b', target_id = ${targetB.inA}`],
    ["workspace_id", () => sql`workspace_id = ${B}`],
  ])("rejects an update of %s", async (_, assignment) => {
    expect(await failure(update(assignment()))).toEqual(IMMUTABLE);
  });

  it("allows an update of any other column", async () => {
    await update(sql`note = 'second'`);
    const [row] = await admin`select note, target_id from scratch.ref where id = ${refId}`;
    expect(row).toEqual({ note: "second", target_id: targetA.inA });
  });

  it("rejects a retarget through the superuser connection too", async () => {
    expect(await failure(admin`update scratch.ref set target_id = ${targetA.alsoInA} where id = ${refId}`)).toEqual(IMMUTABLE);
  });
});

describe("append-only fixture: both layers refuse a retarget", () => {
  it("as crm_app by the missing UPDATE grant (42501), and as superuser by the trigger", async () => {
    const id = await inWorkspace(A, (tx) => insertRef(tx, "ref_ao", { workspaceId: A, type: "a", targetId: targetA.inA }));
    const asApp = await failure(
      inWorkspace(A, (tx) => tx.execute(sql`update scratch.ref_ao set target_id = ${targetA.alsoInA} where id = ${id}`)),
    );
    expect(asApp?.code).toBe("42501");
    expect(await failure(admin`update scratch.ref_ao set target_id = ${targetA.alsoInA} where id = ${id}`)).toEqual(IMMUTABLE);
    expect(await failure(admin`update scratch.ref_ao set workspace_id = ${B} where id = ${id}`)).toEqual(IMMUTABLE);
  });
});

describe("retention-style uniqueness (spec version_retention)", () => {
  const insert = (row: { qv: string | null; psv: string | null; sourceId: string }, onConflict = "") =>
    inWorkspace(A, (tx) =>
      tx.execute(
        sql`insert into scratch.retention (workspace_id, qv_id, psv_id, source_type, source_id)
            values (${A}, ${row.qv}, ${row.psv}, 'invoice', ${row.sourceId}) ${sql.raw(onConflict)}`,
      ),
    );
  const count = async () => Number((await admin`select count(*)::int as n from scratch.retention`)[0]?.n);

  it.each([
    ["quotation version", "qv"],
    ["proposal sent version", "psv"],
  ] as const)("rejects a duplicate per %s target (23505)", async (_, column) => {
    const target = randomUUID();
    const sourceId = randomUUID();
    const row = { qv: column === "qv" ? target : null, psv: column === "psv" ? target : null, sourceId };
    await insert(row);
    expect((await failure(insert(row)))?.code).toBe("23505");
    await insert({ ...row, sourceId: randomUUID() });
  });

  it("rejects neither and both targets (23514)", async () => {
    expect((await failure(insert({ qv: null, psv: null, sourceId: randomUUID() })))?.code).toBe("23514");
    expect((await failure(insert({ qv: randomUUID(), psv: randomUUID(), sourceId: randomUUID() })))?.code).toBe("23514");
  });

  it("ON CONFLICT DO NOTHING against the matching partial index inserts nothing", async () => {
    const row = { qv: randomUUID(), psv: null, sourceId: randomUUID() };
    await insert(row);
    const before = await count();
    const conflict = "ON CONFLICT (workspace_id, qv_id, source_type, source_id) WHERE qv_id IS NOT NULL DO NOTHING";
    await insert(row, conflict);
    expect(await count()).toBe(before);
  });
});

describe("the functions as installed by migration 0006", () => {
  it("are SECURITY INVOKER plpgsql with a pinned search_path, owned by crm_migrator, executable by no other role", async () => {
    const rows = await admin`
      select p.proname as name, l.lanname as language, p.prosecdef as definer, p.proconfig as config,
             pg_get_userbyid(p.proowner) as owner,
             array(select r.rolname from pg_roles r
                   where r.rolname <> pg_get_userbyid(p.proowner) and not r.rolsuper
                     and has_function_privilege(r.oid, p.oid, 'EXECUTE') order by 1) as executors
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname like 'poly_ref_%' order by 1`;
    const expected = (name: string) => ({
      name,
      language: "plpgsql",
      definer: false,
      config: ["search_path=pg_catalog, public"],
      owner: "crm_migrator",
      executors: [],
    });
    expect(rows).toEqual([expected("poly_ref_check_insert"), expected("poly_ref_forbid_retarget")]);
  });
});
