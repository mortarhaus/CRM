import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  columnShape,
  effectivePrivileges,
  holdsCommand,
  NO_RLS_ALLOW_LIST,
  policies,
  rowSecurity,
  tenantTables,
  WORKSPACE_PREDICATE,
  workspacePredicateText,
  type Policy,
} from "../test/catalog";
import { startDatabase, type TestDatabase } from "../test/postgres";
import { EXPECTED_PRIVILEGES, type ManifestRole } from "./privileges";

const NULLIF_WORKSPACE_SETTING = "NULLIF(current_setting('app.workspace_id'::text, true), ''::text)";
const POLICY_ROLES = ["crm_app", "crm_purge"] as const;
const COMMANDS = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;
type Privileges = Partial<Record<string, readonly string[]>>;

let database: TestDatabase;
let admin: postgres.Sql;
let predicate: string;

beforeAll(async () => {
  database = await startDatabase();
  admin = postgres(database.adminUrl, { max: 1, onnotice: () => {} });
  predicate = await workspacePredicateText(admin);
});

afterAll(async () => {
  await admin?.end();
  await database?.stop();
});

// Spec Tenancy and Known risk R1: once a transaction-local set_config has run on a connection, the setting
// reads '' and ''::uuid fails with 22P02, so every current_setting( must be the nullif-wrapped workspace setting.
async function policiesWithoutNullif(schema: string): Promise<string[]> {
  const count = (text: string, part: string) => text.split(part).length - 1;
  return (await policies(admin, schema)).flatMap((policy) =>
    (["qual", "withCheck"] as const)
      .filter((field) => {
        const text = policy[field] ?? "";
        return count(text, "current_setting(") !== count(text, NULLIF_WORKSPACE_SETTING);
      })
      .map((field) => `${schema}.${policy.table}.${policy.name} ${field}`),
  );
}

// Spec Anonymous access: the one non-workspace policy, allowed when present (it arrives in Phase 7).
const isShareLinkResolve = (policy: Policy) =>
  policy.table === "share_link" &&
  policy.name === "share_link_resolve" &&
  policy.permissive === "PERMISSIVE" &&
  policy.cmd === "SELECT" &&
  policy.roles.join() === "crm_link_resolver";

// TEN-04 to TEN-07 and spec Tenancy "Policy form": ENABLE + FORCE, one RESTRICTIVE workspace policy for ALL
// to crm_app and crm_purge, and one PERMISSIVE policy per command, for exactly the commands each role holds.
async function policyFormViolations(schema: string, table: string, privileges: Privileges): Promise<string[]> {
  const found: string[] = [];
  const security = await rowSecurity(admin, schema, table);
  if (!security?.enabled) found.push(`${table}: row level security not enabled`);
  if (!security?.forced) found.push(`${table}: row level security not forced`);
  const key = await columnShape(admin, schema, table, "workspace_id");
  if (key?.type !== "uuid" || !key.notNull) found.push(`${table}: no non-null uuid workspace_id`);

  const all = await policies(admin, schema, table);
  const restrictive = all.filter((policy) => policy.permissive === "RESTRICTIVE");
  if (restrictive.length !== 1) found.push(`${table}: ${restrictive.length} RESTRICTIVE policies, expected 1`);
  for (const policy of restrictive) {
    if (policy.cmd !== "ALL") found.push(`${table}.${policy.name}: RESTRICTIVE for ${policy.cmd}, expected ALL`);
    if (policy.roles.join() !== POLICY_ROLES.join()) found.push(`${table}.${policy.name}: RESTRICTIVE roles ${policy.roles}`);
    if (policy.qual !== predicate) found.push(`${table}.${policy.name}: RESTRICTIVE USING is not the workspace predicate`);
    if (policy.withCheck !== predicate) found.push(`${table}.${policy.name}: RESTRICTIVE WITH CHECK is not the workspace predicate`);
  }

  const permissive = all.filter((policy) => policy.permissive === "PERMISSIVE" && !isShareLinkResolve(policy));
  for (const policy of permissive) {
    const where = `${table}.${policy.name}`;
    if (policy.cmd === "ALL") found.push(`${where}: blanket PERMISSIVE policy for ALL`);
    for (const role of policy.roles) {
      if (!(POLICY_ROLES as readonly string[]).includes(role)) found.push(`${where}: PERMISSIVE policy names ${role}`);
      else if (policy.cmd !== "ALL" && !holdsCommand(privileges, role, schema, table, policy.cmd)) {
        found.push(`${where}: PERMISSIVE ${policy.cmd} for ${role}, which holds no ${policy.cmd} grant`);
      }
    }
    const usesQual = policy.cmd !== "INSERT";
    const usesCheck = policy.cmd === "INSERT" || policy.cmd === "UPDATE";
    if (policy.qual !== (usesQual ? predicate : null)) found.push(`${where}: USING is not the workspace predicate`);
    if (policy.withCheck !== (usesCheck ? predicate : null)) found.push(`${where}: WITH CHECK is not the workspace predicate`);
  }
  for (const role of POLICY_ROLES) {
    for (const command of COMMANDS) {
      const covered = permissive.some((policy) => policy.cmd === command && policy.roles.includes(role));
      if (holdsCommand(privileges, role, schema, table, command) && !covered) {
        found.push(`${table}: no PERMISSIVE ${command} policy for ${role}, which holds the grant`);
      }
    }
  }
  return found;
}

// Spec Tenancy: no policy names PUBLIC, crm_link_resolver (except share_link_resolve), crm_worker or crm_migrator.
async function policyRoleViolations(schema: string): Promise<string[]> {
  return (await policies(admin, schema))
    .filter((policy) => !isShareLinkResolve(policy))
    .flatMap((policy) =>
      policy.roles
        .filter((role) => !(POLICY_ROLES as readonly string[]).includes(role))
        .map((role) => `${policy.table}.${policy.name}: names ${role}`),
    );
}

// Spec Tenancy: the tables without RLS are exactly the system tables on the allow-list and every pgboss table.
// Since rate_limit (plan Task 21) every listed table exists; the test below checks that each one does (Task 8, 29).
async function noRlsViolations(schema: string, allowList: readonly string[] | "every table"): Promise<string[]> {
  const rows = await admin<{ name: string; rls: boolean }[]>`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('r', 'p')
    order by 1`;
  const allowed = (name: string) => allowList === "every table" || allowList.includes(name);
  return rows.flatMap((row) => {
    if (!row.rls && !allowed(row.name)) return [`${schema}.${row.name}: no row level security and not on the allow-list`];
    if (row.rls && allowed(row.name)) return [`${schema}.${row.name}: on the no-RLS allow-list but has row level security`];
    return [];
  });
}

// A policy on a table without RLS is never applied, so one there would only look like protection (plan Task 31 R12).
async function noRlsPolicyViolations(schema: string, allowList: readonly string[]): Promise<string[]> {
  return (await policies(admin, schema))
    .filter((policy) => allowList.includes(policy.table))
    .map((policy) => `${policy.table}.${policy.name}: a policy on a table on the no-RLS allow-list`);
}

describe("no-RLS allow-list (spec Tenancy)", () => {
  it("public: every table on the allow-list exists", async () => {
    const rows = await admin<{ name: string }[]>`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')`;
    const existing = new Set(rows.map((row) => row.name));
    expect(NO_RLS_ALLOW_LIST.filter((name) => !existing.has(name))).toEqual([]);
  });

  it("public: the tables without RLS are exactly the system tables on the allow-list", async () => {
    expect(await noRlsViolations("public", NO_RLS_ALLOW_LIST)).toEqual([]);
  });

  it("public: no table on the allow-list has a policy", async () => {
    expect(await noRlsPolicyViolations("public", NO_RLS_ALLOW_LIST)).toEqual([]);
  });

  it("reports a policy on a table on the allow-list", async () => {
    await admin.unsafe("CREATE POLICY policy_probe ON public.auth_audit_log FOR INSERT TO crm_app WITH CHECK (true)");
    try {
      expect(await noRlsPolicyViolations("public", NO_RLS_ALLOW_LIST)).toEqual([
        "auth_audit_log.policy_probe: a policy on a table on the no-RLS allow-list",
      ]);
    } finally {
      await admin.unsafe("DROP POLICY policy_probe ON public.auth_audit_log");
    }
  });

  it("pgboss: every table, and only pgboss tables beyond the allow-list", async () => {
    expect(await noRlsViolations("pgboss", "every table")).toEqual([]);
  });

  it("drizzle: the migration ledger is out of reach of every runtime role", async () => {
    const roles: ManifestRole[] = ["crm_app", "crm_worker", "crm_purge", "crm_link_resolver", "PUBLIC"];
    const reachable: string[] = [];
    for (const role of roles) {
      const privileges = await effectivePrivileges(admin, role, ["drizzle"]);
      reachable.push(...privileges.filter((privilege) => !privilege.startsWith("database:")).map((p) => `${role} ${p}`));
    }
    expect(reachable).toEqual([]);
  });

  it("reports a table without RLS that is not on the list, and a listed table with RLS", async () => {
    await admin.unsafe("CREATE TABLE public.no_rls_probe (id uuid)");
    await admin.unsafe("CREATE TABLE public.listed_probe (id uuid)");
    await admin.unsafe("ALTER TABLE public.listed_probe ENABLE ROW LEVEL SECURITY");
    try {
      expect(await noRlsViolations("public", [...NO_RLS_ALLOW_LIST, "listed_probe"])).toEqual([
        "public.listed_probe: on the no-RLS allow-list but has row level security",
        "public.no_rls_probe: no row level security and not on the allow-list",
      ]);
    } finally {
      await admin.unsafe("DROP TABLE public.no_rls_probe, public.listed_probe");
    }
  });
});

describe("tenant tables", () => {
  it("are not an empty set, so the checks below test something", async () => {
    expect(await tenantTables(admin)).not.toEqual([]);
  });
});

describe("policy lint: nullif on the workspace setting (Known risk R1)", () => {
  it("finds no policy in public that reads current_setting without nullif", async () => {
    expect(await policiesWithoutNullif("public")).toEqual([]);
  });

  it("reports a policy that casts current_setting without nullif", async () => {
    await admin.unsafe("CREATE SCHEMA IF NOT EXISTS scratch");
    await admin.unsafe("CREATE TABLE scratch.lint_bare (workspace_id uuid not null)");
    await admin.unsafe(
      "CREATE POLICY lint_bare_select ON scratch.lint_bare FOR SELECT TO crm_app USING (workspace_id = current_setting('app.workspace_id', true)::uuid)",
    );
    await admin.unsafe(
      `CREATE POLICY lint_mixed_select ON scratch.lint_bare FOR SELECT TO crm_app USING (${WORKSPACE_PREDICATE} OR workspace_id = current_setting('app.workspace_id', true)::uuid)`,
    );
    await admin.unsafe(`CREATE POLICY lint_ok_select ON scratch.lint_bare FOR SELECT TO crm_app USING (${WORKSPACE_PREDICATE})`);
    try {
      expect(await policiesWithoutNullif("scratch")).toEqual([
        "scratch.lint_bare.lint_bare_select qual",
        "scratch.lint_bare.lint_mixed_select qual",
      ]);
    } finally {
      await admin.unsafe("DROP TABLE scratch.lint_bare");
    }
  });
});

describe("RESTRICTIVE + PERMISSIVE policy form (TEN-04 to TEN-07)", () => {
  it("holds on every tenant table", async () => {
    const found: string[] = [];
    for (const table of await tenantTables(admin)) {
      found.push(...(await policyFormViolations("public", table, EXPECTED_PRIVILEGES)));
    }
    expect(found).toEqual([]);
  });

  it("no policy in public names PUBLIC, crm_link_resolver, crm_worker or crm_migrator", async () => {
    expect(await policyRoleViolations("public")).toEqual([]);
  });

  describe("the check itself", () => {
    const fixtureGrants: Privileges = {
      crm_app: ["table:scratch.form:SELECT", "table:scratch.form:INSERT", "column:scratch.form.label:UPDATE"],
    };
    const restrictive = `CREATE POLICY form_workspace ON scratch.form AS RESTRICTIVE FOR ALL TO crm_app, crm_purge USING (${WORKSPACE_PREDICATE}) WITH CHECK (${WORKSPACE_PREDICATE})`;
    const select = `CREATE POLICY form_app_select ON scratch.form FOR SELECT TO crm_app USING (${WORKSPACE_PREDICATE})`;
    const insert = `CREATE POLICY form_app_insert ON scratch.form FOR INSERT TO crm_app WITH CHECK (${WORKSPACE_PREDICATE})`;
    const update = `CREATE POLICY form_app_update ON scratch.form FOR UPDATE TO crm_app USING (${WORKSPACE_PREDICATE}) WITH CHECK (${WORKSPACE_PREDICATE})`;
    const template = [restrictive, select, insert, update];

    async function violationsFor(statements: string[], options: { force?: boolean } = {}): Promise<string[]> {
      await admin.unsafe("CREATE SCHEMA IF NOT EXISTS scratch");
      await admin.unsafe("CREATE TABLE scratch.form (workspace_id uuid not null, label text)");
      await admin.unsafe("ALTER TABLE scratch.form ENABLE ROW LEVEL SECURITY");
      if (options.force ?? true) await admin.unsafe("ALTER TABLE scratch.form FORCE ROW LEVEL SECURITY");
      try {
        for (const statement of statements) await admin.unsafe(statement);
        return [
          ...(await policyFormViolations("scratch", "form", fixtureGrants)),
          ...(await policyRoleViolations("scratch")),
        ];
      } finally {
        await admin.unsafe("DROP TABLE scratch.form");
      }
    }

    it("accepts the policy template", async () => {
      expect(await violationsFor(template)).toEqual([]);
    });

    it("reports a blanket permissive policy with no restrictive one", async () => {
      expect(await violationsFor(["CREATE POLICY form_all ON scratch.form FOR ALL TO crm_app USING (true)"])).toEqual(
        expect.arrayContaining([
          "form: 0 RESTRICTIVE policies, expected 1",
          "form.form_all: blanket PERMISSIVE policy for ALL",
          "form.form_all: USING is not the workspace predicate",
          "form: no PERMISSIVE SELECT policy for crm_app, which holds the grant",
        ]),
      );
    });

    it.each([
      ["RLS not forced", template, { force: false }, "form: row level security not forced"],
      [
        "a restrictive policy without crm_purge",
        [restrictive.replace("crm_app, crm_purge", "crm_app"), select, insert, update],
        {},
        "form.form_workspace: RESTRICTIVE roles crm_app",
      ],
      [
        "a restrictive policy without WITH CHECK",
        [restrictive.replace(/ WITH CHECK \(.*\)$/, ""), select, insert, update],
        {},
        "form.form_workspace: RESTRICTIVE WITH CHECK is not the workspace predicate",
      ],
      [
        "a permissive policy for a command with no grant",
        [...template, `CREATE POLICY form_app_delete ON scratch.form FOR DELETE TO crm_app USING (${WORKSPACE_PREDICATE})`],
        {},
        "form.form_app_delete: PERMISSIVE DELETE for crm_app, which holds no DELETE grant",
      ],
      [
        "a granted command with no permissive policy",
        [restrictive, select, insert],
        {},
        "form: no PERMISSIVE UPDATE policy for crm_app, which holds the grant",
      ],
      [
        "a permissive policy with a weaker predicate",
        [restrictive, select, insert, update.replace(/USING \(.*\) WITH/, "USING (true) WITH")],
        {},
        "form.form_app_update: USING is not the workspace predicate",
      ],
      [
        "a policy for PUBLIC",
        [...template, `CREATE POLICY form_public ON scratch.form FOR SELECT USING (${WORKSPACE_PREDICATE})`],
        {},
        "form.form_public: names public",
      ],
      [
        "a policy for crm_worker",
        [...template, `CREATE POLICY form_worker ON scratch.form FOR SELECT TO crm_worker USING (${WORKSPACE_PREDICATE})`],
        {},
        "form.form_worker: names crm_worker",
      ],
    ])("reports %s", async (_, statements, options, expected) => {
      expect(await violationsFor(statements, options)).toContain(expected);
    });
  });
});
