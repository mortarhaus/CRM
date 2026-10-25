/* eslint-disable no-restricted-syntax -- the strings below are fixtures for the rules this file tests */
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
