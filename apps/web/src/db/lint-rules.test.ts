/* eslint-disable no-restricted-syntax -- the strings below are fixtures for the rules this file tests */
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const TEN_09 = "Set the workspace only through withWorkspace() (TEN-09)";

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: REPO_ROOT });
});

async function restrictedSyntax(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "no-restricted-syntax")
    .map((message) => message.message);
}

const fixture = (statement: string) => `declare const tx: { execute(query: unknown): Promise<unknown> };
declare const sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
declare const raw: (text: string) => unknown;
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
});
