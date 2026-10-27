/* eslint-disable no-restricted-syntax -- the strings below are fixtures for the rules this file tests */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";
import * as authSchema from "./schema/auth";
import * as systemSchema from "./schema/system";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const TEN_09 = "Set the workspace only through withWorkspace() (TEN-09)";
const TEN_10 = "Use withWorkspace() for tenant data or a function of src/db/system for system tables (TEN-10)";
const TEN_10_SCHEMA = "Only src/db/system reads or writes the system tables (TEN-10)";

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO_ROOT });
});

async function messagesOf(ruleId: string, code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((message) => message.ruleId === ruleId).map((message) => message.message);
}

const restrictedSyntax = (code: string, filePath: string) => messagesOf("no-restricted-syntax", code, filePath);
const restrictedImports = (code: string, filePath: string) => messagesOf("no-restricted-imports", code, filePath);

const fixture = (statement: string) => `declare const tx: { execute(query: unknown): Promise<unknown> };
declare const sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
declare const raw: (text: string) => unknown;
declare const postgres: (url: string, options: unknown) => unknown;
declare const url: string;
declare const workspaceId: string;
export const run = () => ${statement};
`;

describe("TEN-09: the workspace is set only through withWorkspace()", () => {
  it.each([
    ["set_config(…, false) in a template", "tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, false)`)"],
    ["set_config(…, true) outside workspace.ts", "tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)"],
    ["set_config in a string", "tx.execute(raw(\"select set_config('app.workspace_id', 'x', false)\"))"],
    ["SET app.workspace_id", "tx.execute(sql`SET app.workspace_id = ${workspaceId}`)"],
    ["SET LOCAL app.workspace_id", "tx.execute(raw('set local app.workspace_id = 1'))"],
    ["SET SESSION app.workspace_id", "tx.execute(sql`SET SESSION app.workspace_id = ${workspaceId}`)"],
    ["SET LOCAL ROLE", "tx.execute(sql`SET LOCAL ROLE crm_purge`)"],
    ["SET ROLE", "tx.execute(raw('SET ROLE crm_purge'))"],
    ["SET SESSION AUTHORIZATION", "tx.execute(sql`SET SESSION AUTHORIZATION crm_purge`)"],
    ['a quoted "set_config"', "tx.execute(sql`select \"set_config\"('app.workspace_id', ${workspaceId}, false)`)"],
    ["an app. setting as a connection parameter", "postgres(url, { connection: { 'app.workspace_id': workspaceId } })"],
    ["an app. setting in the connection options", "postgres(url, { connection: { options: '-c app.workspace_id=' + workspaceId } })"],
    ["an app. setting in templated connection options", "postgres(url, { connection: { options: `-c app.workspace_id=${workspaceId}` } })"],
  ])("reports %s", async (_, statement) => {
    expect(await restrictedSyntax(fixture(statement), "apps/web/src/lib/x.ts")).toContain(TEN_09);
  });

  it("allows the one set_config(…, true) call in apps/web/src/db/workspace.ts", async () => {
    const code = fixture("tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`)");
    expect(await restrictedSyntax(code, "apps/web/src/db/workspace.ts")).toEqual([]);
  });

  it("does not report other SET LOCAL settings or reads of the setting", async () => {
    const code = fixture(
      "[tx.execute(raw(\"SET LOCAL log_statement = 'none'\")), tx.execute(sql`select current_setting('app.workspace_id', true)`)]",
    );
    expect(await restrictedSyntax(code, "apps/web/src/lib/x.ts")).toEqual([]);
  });

  it("does not report other connection parameters", async () => {
    const code = fixture("postgres(url, { connection: { application_name: 'crm', options: '-c statement_timeout=5000' } })");
    expect(await restrictedSyntax(code, "apps/web/src/lib/x.ts")).toEqual([]);
  });
});

describe("TEN-10: app code reaches the database only through withWorkspace() or src/db/system", () => {
  const ACTIONS = "apps/web/src/app/(app)/x/actions.ts";

  it.each([
    ["getDb from the db barrel", 'import { getDb } from "../../../db";'],
    ["getDb through the @ alias", 'import { getDb } from "@/db";'],
    ["the db index", 'import { getDb } from "@/db/index";'],
    ["createDb from the client", 'import { createDb } from "@/db/client";'],
    ["a system table from the schema barrel", 'import { organization } from "@/db/schema";'],
    ["member from the schema barrel", 'import { member } from "../../../db/schema";'],
    ["billingAccount from schema/system", 'import { billingAccount } from "@/db/schema/system";'],
    ["rateLimit from schema/system", 'import { rateLimit } from "@/db/schema/system";'],
    ["authAuditLog from schema/system", 'import { authAuditLog } from "@/db/schema/system";'],
    ["authAuditLog from the schema barrel", 'import { authAuditLog } from "@/db/schema";'],
    ["a module of src/db/system past its barrel", 'import { getMembership } from "@/db/system/workspaces";'],
    ["the db barrel through a dynamic import", 'export const load = () => import("@/db");'],
  ])("reports %s in app code", async (_, code) => {
    const messages = [...(await restrictedImports(code, ACTIONS)), ...(await restrictedSyntax(code, ACTIONS))];
    expect(messages.join("\n")).toContain(TEN_10);
  });

  it.each([
    ["withWorkspace", 'import { withWorkspace, type Tx } from "@/db/workspace";'],
    ["the system module barrel", 'import { getMembership } from "@/db/system";'],
  ])("allows %s in app code", async (_, code) => {
    expect(await restrictedImports(code, ACTIONS)).toEqual([]);
  });

  it("allows the same imports inside src/db/system", async () => {
    const code = 'import { getDb } from "../index";\nimport { member, organization } from "../schema";\nimport { billingAccount } from "../schema/system";';
    expect(await restrictedImports(code, "apps/web/src/db/system/workspaces.ts")).toEqual([]);
  });

  it.each([
    ["schema/auth", 'import { session } from "./schema/auth";'],
    ["schema/system", 'import { billingAccount } from "./schema/system";'],
    ["authAuditLog from the schema barrel", 'import { authAuditLog } from "./schema";'],
    ["a system table from the schema barrel", 'import { member } from "./schema";'],
    ["the whole schema barrel", 'import * as schema from "./schema";'],
  ])("reports %s elsewhere in src/db", async (_, code) => {
    expect((await restrictedImports(code, "apps/web/src/db/x.ts")).join("\n")).toContain(TEN_10_SCHEMA);
  });

  it("covers every export of schema/auth and schema/system", async () => {
    const unrestricted: string[] = [];
    for (const name of [...Object.keys(authSchema), ...Object.keys(systemSchema)]) {
      const messages = await restrictedImports(`import { ${name} } from "./schema";`, "apps/web/src/db/x.ts");
      if (!messages.join("\n").includes(TEN_10_SCHEMA)) unrestricted.push(name);
    }
    expect(unrestricted).toEqual([]);
  });

  it("allows tenant tables from the schema barrel elsewhere in src/db", async () => {
    expect(await restrictedImports('import { workspaceSettings } from "./schema";', "apps/web/src/db/x.ts")).toEqual([]);
  });
});

describe("TEN-10: import forms and database clients (PR #43 Round 1 P2)", () => {
  const ACTIONS = "apps/web/src/app/(app)/x/actions.ts";
  const DB_CLIENT = "Open database connections only in src/db (TEN-10)";
  const tsRestrictedImports = (code: string, filePath: string) => messagesOf("@typescript-eslint/no-restricted-imports", code, filePath);
  const allImportMessages = async (code: string, filePath: string) =>
    [...(await restrictedImports(code, filePath)), ...(await tsRestrictedImports(code, filePath)), ...(await restrictedSyntax(code, filePath))].join("\n");

  it.each([
    ["the db index with a .js extension", 'import { getDb } from "../../../db/index.js";', TEN_10],
    ["the db barrel with a trailing slash", 'import { getDb } from "../../../db/";', TEN_10],
    ["the client with a .js extension", 'import { createDb } from "@/db/client.js";', TEN_10],
    ["the schema with a .ts extension", 'import { member } from "@/db/schema.ts";', TEN_10],
    ["a new postgres client", 'import postgres from "postgres";\nexport const client = postgres("postgres://x");', DB_CLIENT],
    ["drizzle's postgres-js driver", 'import { drizzle } from "drizzle-orm/postgres-js";', DB_CLIENT],
    ["pg", 'import { Pool } from "pg";', DB_CLIENT],
    ["postgres through a dynamic import", 'export const load = () => import("postgres");', DB_CLIENT],
  ])("reports %s in app code", async (_, code, message) => {
    expect(await allImportMessages(code, ACTIONS)).toContain(message);
  });

  it.each([
    ["withWorkspace with a .js extension", 'import { withWorkspace } from "@/db/workspace.js";'],
    ["a type-only postgres import", 'import type postgres from "postgres";'],
    ["pg-boss, which is not pg", 'import { PgBoss } from "pg-boss";'],
  ])("allows %s in app code", async (_, code) => {
    expect(await allImportMessages(code, ACTIONS)).toBe("");
  });

  it.each([
    ["src/db", "apps/web/src/db/client.ts"],
    ["a test", "apps/web/src/lib/x.test.ts"],
  ])("allows a postgres client in %s", async (_, filePath) => {
    expect(await tsRestrictedImports('import postgres from "postgres";', filePath)).toEqual([]);
  });

  it("reports a postgres client in worker.ts (the Phase 0 exemption ended in Phase 1 PR 5)", async () => {
    expect((await tsRestrictedImports('import postgres from "postgres";', "apps/web/worker.ts")).join("\n")).toContain(DB_CLIENT);
  });

  it("lets worker.ts open its crm_app pool through the system module", async () => {
    expect(await allImportMessages('import { openDatabase } from "./src/db/system";', "apps/web/worker.ts")).toBe("");
  });

  it("reports schema/system with a .js extension elsewhere in src/db", async () => {
    expect((await restrictedImports('import { billingAccount } from "./schema/system.js";', "apps/web/src/db/x.ts")).join("\n")).toContain(
      TEN_10_SCHEMA,
    );
  });
});

// UNI-04 (plan Task 18): node-postgres only inside pg-boss, everywhere in apps/web (src/db and tests included).
describe("UNI-04: pg is allowed only inside pg-boss", () => {
  const PG = "pg is allowed only inside pg-boss (Charlie, 2026-09-30)";
  const allMessages = async (code: string, filePath: string) => {
    const [result] = await eslint.lintText(code, { filePath });
    return (result?.messages ?? []).map((message) => message.message);
  };
  const PATHS = [
    "apps/web/src/lib/x.ts",
    "apps/web/src/app/(app)/x/actions.ts",
    "apps/web/worker.ts",
    "apps/web/scripts/x.ts",
    "apps/web/src/db/x.ts",
    "apps/web/src/db/client.ts",
    "apps/web/src/db/workspace.ts",
    "apps/web/src/db/system/x.ts",
    "apps/web/src/lib/auth/server.ts",
    "apps/web/src/test/x.ts",
    "apps/web/src/lib/x.test.ts",
    "apps/web/src/db/x.test.ts",
  ];
  const FORMS: [form: string, code: string][] = [
    ["import pg from \"pg\"", 'import pg from "pg";\nexport const client = new pg.Client();'],
    ["import { Pool } from \"pg-pool\"", 'import { Pool } from "pg-pool";\nexport const pool = new Pool();'],
    ["await import(\"pg\")", 'export const load = async () => await import("pg");'],
    ["a pg subpath", 'import { Client } from "pg/lib/client";\nexport const client = Client;'],
    ["pg-cursor", 'import Cursor from "pg-cursor";\nexport const cursor = Cursor;'],
    ["pg-native", 'import Native from "pg-native";\nexport const native = Native;'],
    ["pg-query-stream", 'import QueryStream from "pg-query-stream";\nexport const stream = QueryStream;'],
  ];

  it.each(PATHS.flatMap((filePath) => FORMS.map(([form, code]) => [form, filePath, code] as const)))(
    "reports %s in %s",
    async (_, filePath, code) => {
      expect((await allMessages(code, filePath)).join("\n")).toContain(PG);
    },
  );

  it.each(PATHS)("allows pg-boss in %s", async (filePath) => {
    const messages = await allMessages('import { PgBoss } from "pg-boss";\nexport const boss = PgBoss;', filePath);
    expect(messages.filter((message) => message.includes(PG) || message.includes("TEN-10"))).toEqual([]);
  });
});

// AUTH-01 (plan Task 15): every server action goes through action() or is a named Better Auth forwarder.
describe("AUTH-01: every server action goes through action() or is a named forwarder", () => {
  const RULE = "crm/server-action-wrapper";
  const AUTH_01 = "Server actions go through action() (AUTH-01)";
  const SIGN_IN = "apps/web/src/app/(auth)/sign-in/actions.ts";
  const SIGN_UP = "apps/web/src/app/(auth)/sign-up/actions.ts";
  const TWO_FACTOR = "apps/web/src/app/(auth)/two-factor/actions.ts";
  const APP = "apps/web/src/app/(app)/actions.ts";
  const SECURITY = "apps/web/src/app/(app)/settings/security/actions.ts";
  const WORKSPACES = "apps/web/src/app/(app)/workspaces/actions.ts";
  const EMAIL_ACTIONS = "apps/web/src/app/(app)/settings/email/actions.ts";
  const MUTATIONS = "apps/web/src/app/(app)/settings/email/mutations.ts";

  interface Finding {
    message: string;
    line: string;
  }

  async function findings(code: string, filePath: string): Promise<Finding[]> {
    const [result] = await eslint.lintText(code, { filePath });
    const lines = code.split("\n");
    return (result?.messages ?? [])
      .filter((message) => message.ruleId === RULE || message.fatal)
      .map((message) => ({ message: message.message, line: lines[message.line - 1] ?? "" }));
  }

  const messages = async (code: string, filePath: string) => (await findings(code, filePath)).map((finding) => finding.message);

  // The F-rules reported on a forwarder, from "Forwarder <name> does more than forward to Better Auth (AUTH-01): F<n>: …".
  async function forwarderRules(code: string, filePath: string, name: string): Promise<string[]> {
    const prefix = `Forwarder ${name}`;
    const rules = (await messages(code, filePath))
      .filter((message) => message.startsWith(prefix) && message.includes("does more than forward to Better Auth (AUTH-01)"))
      .map((message) => /\(AUTH-01\): (F\d+b?)/.exec(message)?.[1] ?? "?");
    return [...new Set(rules)].sort();
  }

  const real = (file: string) => readFileSync(path.join(REPO_ROOT, file), "utf8");

  function edit(text: string, anchor: string, replacement: string): string {
    expect(text).toContain(anchor);
    return text.replace(anchor, replacement);
  }

  const before = (text: string, anchor: string, inserted: string) => edit(text, anchor, `${inserted}${anchor}`);
  const after = (text: string, anchor: string, inserted: string) => edit(text, anchor, `${anchor}${inserted}`);

  const DIRECT_WRITE = `export async function saveEmailSettings(form: FormData) {
  const id = String(form.get("workspaceId"));
  await withWorkspace(id, (tx) => tx.insert(workspaceSettings).values({ workspaceId: id }));
}
`;
  const DIRECT_WRITE_IMPORTS = 'import { withWorkspace } from "@/db/workspace";\nimport { workspaceSettings } from "@/db/schema";\n';
  const ACTION_EXPORT = `"use server";
import { z } from "zod";
import { action } from "@/lib/auth/action";

export const doThing = action({
  name: "email.doThing",
  minRole: "admin",
  input: z.object({}),
  idempotent: false,
  handler: async () => null,
});
`;

  describe("which functions are server actions", () => {
    it("reports an export of a \"use server\" module that is not action(), and allows one that is", async () => {
      expect(await messages('"use server";\n\nexport async function doThing() {}\n', EMAIL_ACTIONS)).toEqual([AUTH_01]);
      expect(await messages(ACTION_EXPORT, EMAIL_ACTIONS)).toEqual([]);
    });

    it("reports a direct database write in a differently named file", async () => {
      expect(await messages(`"use server";\n${DIRECT_WRITE_IMPORTS}\n${DIRECT_WRITE}`, MUTATIONS)).toEqual([AUTH_01]);
    });

    it("reports the same body outside src/app", async () => {
      expect(await messages(`"use server";\n${DIRECT_WRITE_IMPORTS}\n${DIRECT_WRITE}`, "apps/web/src/lib/settings-mutations.ts")).toEqual([AUTH_01]);
    });

    it("reads the directive in single quotes too, and ignores a module without it", async () => {
      expect(await messages("'use server';\nexport async function doThing() {}\n", EMAIL_ACTIONS)).toEqual([AUTH_01]);
      expect(await messages("export async function doThing() {}\n", EMAIL_ACTIONS)).toEqual([]);
    });

    it.each([
      ["export default", "export default async function (form: FormData) { void form; }"],
      ["an exported async arrow", "export const x = async () => {};"],
      ["a wrapper call that is not action()", "declare function wrap<T>(f: T): T;\nexport const x = wrap(async () => {});"],
      ["action() from another module", 'import { action } from "./action";\nexport const x = action({});'],
      ["a let binding of action()", 'import { action } from "@/lib/auth/action";\nexport let x = action({});'],
      ["a local binding exported by name", "const x = async () => {};\nexport { x };"],
      ["a local binding exported under another name", "const x = async () => {};\nexport { x as y };"],
      ["a re-export of everything", 'export * from "./other";'],
      ["a named re-export", 'export { x } from "./other";'],
      ["an exported class", "export class Thing {}"],
    ])("reports %s", async (_, body) => {
      expect(await messages(`"use server";\n${body}\n`, EMAIL_ACTIONS)).toContain(AUTH_01);
    });

    it("ignores type-only exports and allows an action() binding exported by name", async () => {
      const code = `"use server";
import { action } from "@/lib/auth/action";
export interface Shape { a: string }
export type Other = string;
interface Local { b: string }
export type { Local };
const doThing = action({});
export { doThing };
`;
      expect(await messages(code, EMAIL_ACTIONS)).toEqual([]);
    });

    it("reports an inline action in a server component", async () => {
      const code = `export default function Page() {
  async function inline() {
    "use server";
  }
  const arrow = async () => {
    "use server";
  };
  void inline;
  void arrow;
  return null;
}
`;
      expect(await messages(code, "apps/web/src/app/(app)/settings/email/page.tsx")).toEqual([AUTH_01, AUTH_01]);
    });
  });

  describe("the named Better Auth forwarders", () => {
    it.each([SIGN_IN, SIGN_UP, TWO_FACTOR, APP, SECURITY, WORKSPACES])("passes %s as it is in the tree (F1 to F9)", async (file) => {
      expect(await messages(real(file), file)).toEqual([]);
    });

    it("reports a forwarder's name at any other path", async () => {
      expect(await messages(real(SIGN_IN), MUTATIONS)).toEqual([AUTH_01]);
    });

    it("reports an extra export in an exempt file on that export only", async () => {
      const code = `${real(WORKSPACES)}
export async function renameWorkspaceAction(_previous: FormState, form: FormData): Promise<FormState> {
  const name = textField(form, "name");
  return { error: null, fields: { name } };
}
`;
      const found = await findings(code, WORKSPACES);
      expect(found).toEqual([{ message: AUTH_01, line: expect.stringContaining("renameWorkspaceAction") }]);
    });
  });

  describe("an exempt body that does more than forward (F1 to F9)", () => {
    it("reports a direct database write inside createWorkspaceAction (F1, F3, F5)", async () => {
      let code = after(real(WORKSPACES), 'import { getCurrentSession } from "@/lib/auth/session";\n', DIRECT_WRITE_IMPORTS);
      code = before(
        code,
        '  const result = await postToAuth("/organization/create"',
        "  const id = name;\n  await withWorkspace(id, (tx) => tx.insert(workspaceSettings).values({ workspaceId: id }));\n",
      );
      const rules = await forwarderRules(code, WORKSPACES, "createWorkspaceAction");
      expect(rules).toEqual(expect.arrayContaining(["F1", "F3", "F5"]));
      const imports = (await findings(code, WORKSPACES)).filter((finding) => finding.message.includes(": F1:")).map((finding) => finding.line);
      expect(imports).toEqual(expect.arrayContaining([expect.stringContaining("@/db/workspace"), expect.stringContaining("@/db/schema")]));
    });

    it("reports a fetch inside signInAction (F3, F5)", async () => {
      const code = before(
        real(SIGN_IN),
        '  const result = await postToAuth("/sign-in/email"',
        '  await fetch("https://example.invalid/hook", { method: "POST" });\n',
      );
      expect(await forwarderRules(code, SIGN_IN, "signInAction")).toEqual(expect.arrayContaining(["F3", "F5"]));
    });

    it("reports a second postToAuth call in signOutAction (F2)", async () => {
      const code = before(real(APP), '  const result = await postToAuth("/sign-out", {});', '  await postToAuth("/sign-out", {});\n');
      expect(await forwarderRules(code, APP, "signOutAction")).toContain("F2");
    });

    it("reports an unused audit import in the setActiveWorkspaceAction file (F1)", async () => {
      const code = after(real(APP), 'import { getCurrentSession } from "@/lib/auth/session";\n', 'import { recordAudit } from "@/lib/audit";\n');
      expect(await forwarderRules(code, APP, "setActiveWorkspaceAction, signOutAction")).toContain("F1");
    });

    it("reports a helper of verifyTwoFactorAction that loads the database (F1 no import(), F3 no async helper)", async () => {
      let code = before(real(TWO_FACTOR), "// The code travels only in the POST body;", 'async function loadDb() {\n  await import("@/db");\n}\n\n');
      code = after(code, "  const method = METHODS[methodName];\n", "  void loadDb();\n");
      const all = await messages(code, TWO_FACTOR);
      expect(all.filter((message) => message.includes("does more than forward")).join("\n")).toMatch(/F1: import\(\)/);
      const helper = all.filter((message) => message.startsWith("Forwarder verifyTwoFactorAction (helper loadDb)")).join("\n");
      expect(helper).toContain("F3: async helper");
      expect(helper).toContain("F3: await outside the listed function");
    });

    it("reports a module-level let written by confirmTwoFactorAction (F6)", async () => {
      let code = before(real(SECURITY), "// The confirm form posts", 'let lastCode = "";\n\n');
      code = before(code, '  const result = await postToAuth("/two-factor/verify-totp"', '  lastCode = textField(form, "code");\n');
      expect(await forwarderRules(code, SECURITY, "confirmTwoFactorAction")).toContain("F6");
    });
  });

  describe("each F-rule on its own, in signOutAction's file", () => {
    const SIGN_OUT_CALL = '  const result = await postToAuth("/sign-out", {});';
    const SESSION_IMPORT = 'import { getCurrentSession } from "@/lib/auth/session";';
    it.each([
      ["another name from an allowed module", "F1", (text: string) => edit(text, SESSION_IMPORT, 'import { getCurrentSession, listWorkspaces } from "@/lib/auth/session";')],
      ["a namespace import", "F1", (text: string) => after(text, `${SESSION_IMPORT}\n`, 'import * as forms from "@/lib/forms";\n')],
      ["a default import", "F1", (text: string) => after(text, `${SESSION_IMPORT}\n`, 'import forward from "@/lib/auth/forward";\n')],
      ["a postToAuth call inside a map callback", "F2", (text: string) => before(text, SIGN_OUT_CALL, '  ["/sign-out"].map((p) => postToAuth(p, {}));\n')],
      ["an awaited local promise", "F3", (text: string) => before(text, SIGN_OUT_CALL, "  const pending = refresh();\n  await pending;\n")],
      ["a method not on the receiver's list", "F4b", (text: string) => before(text, SIGN_OUT_CALL, '  const path = "/sign-out";\n  void path.concat("x");\n')],
      ["a banned name", "F5", (text: string) => before(text, SIGN_OUT_CALL, "  const db = 1;\n  void db;\n")],
      ["a module const holding a function", "F7", (text: string) => before(text, "// Navigates only after", "const HOOK = postToAuth;\n\n")],
      ["an arrow function value", "F8", (text: string) => before(text, SIGN_OUT_CALL, "  const later = () => null;\n  void later;\n")],
      ["an object getter", "F8", (text: string) => before(text, SIGN_OUT_CALL, "  void { get x() { return 1; } };\n")],
      ["a while loop", "F9", (text: string) => before(text, SIGN_OUT_CALL, "  while (String(1) === \"2\") void 0;\n")],
    ])("reports %s (%s)", async (_, rule, change) => {
      const code = change(real(APP));
      const rules = [
        ...(await forwarderRules(code, APP, "signOutAction")),
        ...(await forwarderRules(code, APP, "setActiveWorkspaceAction, signOutAction")),
      ];
      expect(rules).toContain(rule);
    });
  });

  describe("alias and indirect-call bypasses (Bob plan review Round 3, P1)", () => {
    it("reports Bob's alias case: postToAuth in an object, called through it (F7, F4b, F8)", async () => {
      const code = before(
        real(WORKSPACES),
        '  const result = await postToAuth("/organization/create"',
        '  const extra = { send: postToAuth };\n  void extra.send("/organization/create", { name: "Extra", slug: "extra" });\n',
      );
      expect(await forwarderRules(code, WORKSPACES, "createWorkspaceAction")).toEqual(expect.arrayContaining(["F4b", "F7", "F8"]));
    });

    it("reports a computed member call on a global (F3, F4, F5)", async () => {
      const code = before(
        real(SIGN_IN),
        '  const result = await postToAuth("/sign-in/email"',
        '  await globalThis["fetch"]("https://example.invalid/hook", { method: "POST" });\n',
      );
      expect(await forwarderRules(code, SIGN_IN, "signInAction")).toEqual(expect.arrayContaining(["F3", "F4", "F5"]));
    });

    it("reports a sequence callee (F4, F7)", async () => {
      const code = before(
        real(APP),
        '  const result = await postToAuth("/sign-out", {});',
        '  (0, postToAuth)("/organization/set-active", { organizationId: null });\n',
      );
      expect(await forwarderRules(code, APP, "signOutAction")).toEqual(expect.arrayContaining(["F4", "F7"]));
    });

    it("reports a local alias (F3, F4, F7)", async () => {
      const code = before(
        real(WORKSPACES),
        '  const result = await postToAuth("/organization/create"',
        '  const f = postToAuth;\n  await f("/organization/create", { name: "Extra", slug: "extra" });\n',
      );
      expect(await forwarderRules(code, WORKSPACES, "createWorkspaceAction")).toEqual(expect.arrayContaining(["F3", "F4", "F7"]));
    });

    it("reports postToAuth.call (F4, F7)", async () => {
      const code = before(real(APP), '  const result = await postToAuth("/sign-out", {});', '  await postToAuth.call(null, "/sign-out", {});\n');
      expect(await forwarderRules(code, APP, "signOutAction")).toEqual(expect.arrayContaining(["F4", "F7"]));
    });

    it("reports the one call repeated in a loop (F9)", async () => {
      const code = edit(
        real(APP),
        '  const result = await postToAuth("/sign-out", {});\n  if (!result.ok) return { ...EMPTY_FORM_STATE, error: SIGN_OUT_FAILED };\n',
        '  for (const p of ["/sign-out", "/sign-out"]) {\n    const result = await postToAuth(p, {});\n    if (!result.ok) return { ...EMPTY_FORM_STATE, error: SIGN_OUT_FAILED };\n  }\n',
      );
      expect(await forwarderRules(code, APP, "signOutAction")).toContain("F9");
    });

    it("reports postToAuth passed out to a helper (F4, F7)", async () => {
      let code = before(
        real(SECURITY),
        "// The confirm form posts",
        'function run(fn: (path: string, body: object) => unknown) {\n  return fn("/two-factor/disable", {});\n}\n\n',
      );
      code = before(code, '  const result = await postToAuth("/two-factor/verify-totp"', "  run(postToAuth);\n");
      const all = await messages(code, SECURITY);
      expect(all.some((message) => message.startsWith("Forwarder confirmTwoFactorAction does") && message.includes(": F7:"))).toBe(true);
      expect(all.some((message) => message.startsWith("Forwarder confirmTwoFactorAction (helper run)") && message.includes(": F4:"))).toBe(true);
    });
  });
});
