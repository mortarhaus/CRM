import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { FORWARDING_ACTIONS } from "../../eslint/forwarding-actions.mjs";

// AUTH-01 (plan Task 15 Step 3): server actions are covered by the server-action-wrapper lint. Every other HTTP entry
// point is classified here, by the names it exports. An unlisted route, or a listed one exporting a method not in its
// row, fails until it is added with its wrapper and its test.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const WEB = path.join(REPO_ROOT, "apps/web");
const CLASSIFY = "classify this entry point (AUTH-01)";

const HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

const ENTRY_POINTS: Record<string, { exports: string[]; coveredBy: string }> = {
  "apps/web/src/app/api/auth/[...all]/route.ts": {
    exports: ["GET", "POST"],
    coveredBy:
      "The named /api/auth/* exception (spec revision 7 (d)): not through action(); DB rate limits, uniform 429, " +
      "enabled-path allow-list (rate-limit.test.ts, enabled-paths.test.ts; plan Tasks 23 and 24).",
  },
  "apps/web/src/app/api/health/route.ts": {
    exports: ["GET"],
    coveredBy: "Read-only, unauthenticated by design (UNI-19); health.test.ts (plan Task 20). No mutating method.",
  },
  "apps/web/src/app/(app)/theme/route.ts": {
    exports: ["POST"],
    coveredBy:
      "AUTH-01 conforming interpretation (Bob, PR #53 R1, confirmed by Charlie 2026-11-04 (Bob session: 1A)): sets " +
      "only the caller's own crm_theme " +
      "cookie, and conforms only while (a) no database read or write beyond the session lookup; (b) same-origin " +
      "Origin required (403 otherwise); (c) signed-in session required; (d) the value allow-listed (parseTheme); " +
      "(e) the redirect target limited to a same-origin path (returnPath); (f) classified here with these conditions " +
      "(lib/theme.test.ts, e2e/theme.spec.ts; Phase 2 plan Task 3).",
  },
  "apps/web/src/app/(app)/files/logo/route.ts": {
    exports: ["GET"],
    coveredBy:
      "Read-only: streams the active workspace's current logo to a signed-in member of it (requireWorkspaceMember, " +
      "then withWorkspace and a match against workspace_settings.logo_key); 404 for anything else, including a " +
      "member of another workspace (TEN-05). No mutating method; the upload is the uploadLogo server action " +
      "(files/logo/route.test.ts, e2e/logo.spec.ts; Phase 2 plan Task 12).",
  },
  "apps/web/src/app/(app)/files/payment-qr/route.ts": {
    exports: ["GET"],
    coveredBy:
      "Read-only: streams the active workspace's current payment QR to its Owner (requireWorkspaceMember('owner'), " +
      "then withWorkspace and a match against workspace_settings.duitnow_qr_key); 404 for anything else, including " +
      "an Admin and another workspace's Owner (TEN-05). No mutating method; the upload is the uploadPaymentQr server " +
      "action (settings/payment/actions.test.ts; Phase 2 plan Task 14).",
  },
  "apps/web/src/proxy.ts": {
    exports: ["proxy"],
    coveredBy: "Sets headers only, reads no database (AUTH-11); security-headers.test.ts (plan Task 25). Not a mutation path.",
  },
};

// Not HTTP entry points, so the walk below does not look for them; recorded here so the list is complete:
// - pg-boss job handlers (apps/web/src/jobs/*): run in the worker under withWorkspace(data.workspaceId) and re-check
//   membership where they act for a user (plan Task 27 Step 2; EVT rules);
// - the CLI scripts db:bootstrap and jobs:retry: operator commands with admin or crm_worker credentials, never
//   reachable over HTTP (runbooks).
const NOT_HTTP_ENTRY_POINTS = ["apps/web/src/jobs/*", "db:bootstrap", "jobs:retry"];

const ROUTE_FILE = /^route\.(ts|tsx|js|jsx|mjs|mts)$/;
// Next.js 16 takes proxy (or the older middleware) from the project root or from src/.
const PROXY_FILES = ["proxy", "middleware"].flatMap((name) =>
  ["", "src/"].flatMap((dir) => ["ts", "js", "mjs", "mts"].map((extension) => `apps/web/${dir}${name}.${extension}`)),
);

function routeFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(full));
    else if (ROUTE_FILE.test(entry.name)) found.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
  }
  return found;
}

function entryPointFiles(): string[] {
  const routes = routeFiles(path.join(WEB, "src/app"));
  const proxies = PROXY_FILES.filter((file) => existsSync(path.join(REPO_ROOT, file)));
  return [...routes, ...proxies].sort();
}

const parse = (file: string, text: string) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

// The value names a module exports. A re-export of everything, or a destructured export, cannot be classified by
// name, so it is returned as "*".
function exportedNames(source: ts.SourceFile): string[] {
  const names: string[] = [];
  const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
  const isDefault = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword);
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      if (!statement.exportClause) names.push("*");
      else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) if (!element.isTypeOnly) names.push(element.name.text);
      } else names.push("*");
    } else if (ts.isExportAssignment(statement)) {
      names.push("default");
    } else if (isExported(statement)) {
      if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
      if (isDefault(statement)) names.push("default");
      else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
          else names.push("*");
        }
      } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) {
        names.push(statement.name.text);
      } else names.push("*");
    }
  }
  return names.sort();
}

// What the table compares: the HTTP methods of a route; every value export of the proxy except its config.
function classifiedNames(file: string): string[] {
  const names = exportedNames(parse(file, readFileSync(path.join(REPO_ROOT, file), "utf8")));
  if (ROUTE_FILE.test(path.basename(file))) return names.filter((name) => HTTP_METHODS.has(name) || name === "*" || name === "default");
  return names.filter((name) => name !== "config");
}

describe("AUTH-01: every HTTP entry point that is not a server action is classified", () => {
  it("finds the entry points of the tree", () => {
    expect(entryPointFiles()).toEqual(expect.arrayContaining(["apps/web/src/app/api/auth/[...all]/route.ts", "apps/web/src/app/api/health/route.ts"]));
  });

  it.each(entryPointFiles())("%s is classified, with exactly the methods in its row", (file) => {
    const row = ENTRY_POINTS[file];
    expect(row, `${file}: ${CLASSIFY}`).toBeDefined();
    expect(classifiedNames(file), `${file}: ${CLASSIFY}`).toEqual([...(row?.exports ?? [])].sort());
  });

  it("records the entry points that are not HTTP", () => {
    expect(NOT_HTTP_ENTRY_POINTS).toEqual(["apps/web/src/jobs/*", "db:bootstrap", "jobs:retry"]);
  });

  it("keeps the health route read-only", () => {
    expect(ENTRY_POINTS["apps/web/src/app/api/health/route.ts"]?.exports.filter((method) => MUTATING.includes(method))).toEqual([]);
  });

  it("reads exports the way Next.js sees them (self-test)", () => {
    const cases: [string, string[]][] = [
      ["export async function GET() {}\nexport const dynamic = 'force-dynamic';", ["GET", "dynamic"]],
      ["const handler = () => null;\nexport { handler as POST, handler as PUT };", ["POST", "PUT"]],
      ["export * from './other';", ["*"]],
      ["export const { GET } = handlers;", ["*"]],
      ["export type Shape = string;\nexport interface Other {}\nexport default function proxy() {}", ["default"]],
    ];
    for (const [code, expected] of cases) expect(exportedNames(parse("probe.ts", code))).toEqual([...expected].sort());
  });
});

// Workspace binding (PR 76 Review R1 P0; DECISIONS 2026-11-25): every server action has a binding decision. Bound: an
// action() export, which always compares the workspace the posting page was rendered for with the session's (no
// opt-out), with its two-workspace case in workspace-binding.test.ts. Exempt: a Better Auth forwarder of the AUTH-01
// lint (forwarding-actions.mjs), which reads and writes no workspace data. A new export of a "use server" file fails
// here until it gets a row.
const FORWARDER = "Better Auth forwarder (forwarding-actions.mjs): no workspace data; ";
const SERVER_ACTIONS: Record<string, Record<string, { bound: string } | { exempt: string }>> = {
  "apps/web/src/app/(app)/actions.ts": {
    setActiveWorkspaceAction: { exempt: `${FORWARDER}it is the switch itself; Better Auth checks membership.` },
    signOutAction: { exempt: `${FORWARDER}ends the user's own session.` },
  },
  "apps/web/src/app/(app)/catalog/actions.ts": {
    createServiceAction: { bound: "catalog create" },
    updateServiceAction: { bound: "catalog update" },
    setServiceArchivedAction: { bound: "catalog archive" },
  },
  "apps/web/src/app/(app)/settings/actions.ts": {
    updateBrandingSettings: { bound: "brand colour" },
    updateGeneralSettings: { bound: "general settings" },
  },
  "apps/web/src/app/(app)/settings/branding/actions.ts": { uploadLogo: { bound: "logo" } },
  "apps/web/src/app/(app)/settings/email/actions.ts": { sendTestEmail: { bound: "test email" } },
  "apps/web/src/app/(app)/settings/numbering/actions.ts": { updateNumberingSettings: { bound: "numbering" } },
  "apps/web/src/app/(app)/settings/payment/actions.ts": {
    confirmStepUp: { bound: "step-up prompt" },
    saveBankDetails: { bound: "bank details" },
    uploadPaymentQr: { bound: "payment QR" },
  },
  "apps/web/src/app/(app)/settings/security/actions.ts": {
    startTwoFactorAction: { exempt: `${FORWARDER}the user's own 2FA enrolment.` },
    confirmTwoFactorAction: { exempt: `${FORWARDER}the user's own 2FA enrolment.` },
  },
  "apps/web/src/app/(app)/settings/templates/actions.ts": { saveEmailTemplateAction: { bound: "email template" } },
  "apps/web/src/app/(app)/workspaces/actions.ts": {
    createWorkspaceAction: { exempt: `${FORWARDER}creates a new workspace, rendered for none.` },
  },
  "apps/web/src/app/(auth)/sign-in/actions.ts": { signInAction: { exempt: `${FORWARDER}no session yet.` } },
  "apps/web/src/app/(auth)/sign-up/actions.ts": { signUpAction: { exempt: `${FORWARDER}no session yet.` } },
  "apps/web/src/app/(auth)/two-factor/actions.ts": { verifyTwoFactorAction: { exempt: `${FORWARDER}sign-in's second step.` } },
  "apps/web/src/app/(onboarding)/onboarding/actions.ts": { completeOnboarding: { bound: "onboarding" } },
};

function serverActionFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...serverActionFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) && /^\s*["']use server["']/.test(readFileSync(full, "utf8"))) {
      found.push(path.relative(REPO_ROOT, full).split(path.sep).join("/"));
    }
  }
  return found.sort();
}

describe("workspace binding: every server action is bound or exempt (PR 76 Review R1 P0)", () => {
  const bindingTests = readFileSync(path.join(WEB, "src/app/workspace-binding.test.ts"), "utf8");

  it("finds exactly the files of the table", () => {
    expect(serverActionFiles(path.join(WEB, "src"))).toEqual(Object.keys(SERVER_ACTIONS).sort());
  });

  it.each(Object.entries(SERVER_ACTIONS))("%s: every export has its row", (file, rows) => {
    const names = exportedNames(parse(file, readFileSync(path.join(REPO_ROOT, file), "utf8")));
    expect(names, `${file}: give each export a binding decision`).toEqual(Object.keys(rows).sort());
    const forwarders = FORWARDING_ACTIONS[file] ?? [];
    for (const [name, row] of Object.entries(rows)) {
      if ("exempt" in row) expect(forwarders, `${file} ${name}: only a forwarder is exempt`).toContain(name);
      else {
        expect(forwarders, `${file} ${name}`).not.toContain(name);
        expect(bindingTests, `${name}: add its case to workspace-binding.test.ts`).toContain(`name: "${row.bound}"`);
      }
    }
  });
});
