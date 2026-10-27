import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import { serverActionWrapper } from "./apps/web/eslint/server-action-wrapper.mjs";

const coreFiles = ["packages/core/**/*.{ts,tsx,mts,cts,js,mjs}"];

const frameworkPackages = ["next", "react", "react-dom", "@next/*"];
const dbAuthPackages = [
  "drizzle-orm",
  "drizzle-kit",
  "postgres",
  "pg",
  "pg-*",
  "better-auth",
  "@better-auth/*",
  "@neondatabase/*",
  "@vercel/postgres",
];
const appPackages = ["@crm/web", "@crm/ext-*"];

const withSubpaths = (names) => names.flatMap((name) => (name.endsWith("/*") ? [name] : [name, `${name}/*`]));

const restrictedSourceRegex = (names) =>
  `^(${withSubpaths(names)
    .map((name) => name.replace(/[.+?^${}()|[\]\\/]/g, "\\$&").replace("*", ".*"))
    .join("|")})$`;

const restrictedDynamicImport = (names, message) => ({
  selector: `ImportExpression[source.value=/${restrictedSourceRegex(names)}/]`,
  message,
});

const workspaceContextPattern = String.raw`/"?set_config"?\s*\(|\bSET\s+((SESSION|LOCAL)\s+)?(ROLE|SESSION\s+AUTHORIZATION|"?app\.)|(-c\s*|--)app\./i`;
const workspaceContextMessage = "Set the workspace only through withWorkspace() (TEN-09)";
const workspaceContextSyntax = [
  { selector: `TemplateElement[value.raw=${workspaceContextPattern}]`, message: workspaceContextMessage },
  { selector: `Literal[value=${workspaceContextPattern}]`, message: workspaceContextMessage },
  // An app. setting passed as a connection parameter would hold for every transaction on that connection.
  { selector: String.raw`Property[key.value=/^app\./]`, message: workspaceContextMessage },
];

// UNI-04: node-postgres only inside pg-boss (Charlie, 2026-09-30). Exact names: a `pg-*` glob would match pg-boss.
// Everywhere in apps/web, src/db and tests included; every block below that sets no-restricted-imports or
// no-restricted-syntax for apps/web repeats these, because a later block replaces a rule's options, it does not merge.
const pgPackages = ["pg", "pg-pool", "pg-cursor", "pg-native", "pg-query-stream"];
const pgMessage = "pg is allowed only inside pg-boss (Charlie, 2026-09-30)";
const pgImport = { group: withSubpaths(pgPackages), message: pgMessage };
const pgDynamicImport = restrictedDynamicImport(pgPackages, pgMessage);

const coreSourceImport = {
  group: ["**/packages/*/src/**"],
  message: "Import core through its package exports (for example @crm/core/password), not its source files.",
};

// TEN-10: app code reaches the database through withWorkspace() (src/db/workspace) or a named function of
// the system module barrel (src/db/system), never through the pool, the client or the schema. A specifier may
// carry a script extension or a trailing slash and still resolve to the same module (PR #43 Round 1 P2).
const moduleSuffix = String.raw`(\.(js|ts|mjs|mts|cjs|cts))?/?`;
const directDbSource = String.raw`(^|/)db(/(index|client|schema(/.*)?|system/.+))?${moduleSuffix}$`;
const directDbMessage = "Use withWorkspace() for tenant data or a function of src/db/system for system tables (TEN-10)";
// TEN-10: no database client outside src/db (PR #43 Round 1 P2); a type import has no runtime value.
const dbClientSource = String.raw`^(postgres|pg|drizzle-orm/postgres-js)(/.*)?$`;
const dbClientMessage = "Open database connections only in src/db (TEN-10)";
// Every export of schema/auth.ts and schema/system.ts (lint-rules.test.ts checks the list is complete).
const systemSchemaExports = [
  "user",
  "session",
  "account",
  "verification",
  "twoFactor",
  "organization",
  "member",
  "invitation",
  "userRelations",
  "sessionRelations",
  "accountRelations",
  "twoFactorRelations",
  "organizationRelations",
  "memberRelations",
  "invitationRelations",
  "billingAccount",
  "authAuditLog",
];
const systemSchemaMessage = "Only src/db/system reads or writes the system tables (TEN-10)";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/**/*.{ts,tsx,mts,cts,js,mjs}", "packages/**/*.{ts,tsx,mts,cts,js,mjs}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "core", pattern: "packages/core" },
        { type: "web", pattern: "apps/web" },
      ],
      "import/resolver": { node: { extensions: [".ts", ".tsx", ".js", ".mjs"] } },
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            { from: { element: { type: "web" } }, allow: { to: { element: { types: { anyOf: ["web", "core"] } } } } },
            { from: { element: { type: "core" } }, allow: { to: { element: { type: "core" } } } },
          ],
        },
      ],
    },
  },
  {
    files: coreFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: withSubpaths(frameworkPackages), message: "packages/core must not import framework code." },
            { group: withSubpaths(dbAuthPackages), message: "packages/core must not import database or auth code." },
            { group: withSubpaths(appPackages), message: "packages/core must not import app or extension code." },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        restrictedDynamicImport(frameworkPackages, "packages/core must not import framework code."),
        restrictedDynamicImport(dbAuthPackages, "packages/core must not import database or auth code."),
        restrictedDynamicImport(appPackages, "packages/core must not import app or extension code."),
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx,mts,cts,js,mjs}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [coreSourceImport, pgImport] }],
    },
  },
  {
    // TEN-09: the workspace context is set only by withWorkspace(), transaction-locally. No other
    // set_config call, no SET of the workspace setting or of the role, and no app. setting on a
    // connection, anywhere in the app.
    files: ["apps/web/**/*.{ts,tsx,mts,cts,js,mjs}"],
    ignores: ["apps/web/src/db/workspace.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...workspaceContextSyntax, pgDynamicImport],
    },
  },
  {
    // The one file the TEN-09 block skips keeps the pg ban.
    files: ["apps/web/src/db/workspace.ts"],
    rules: {
      "no-restricted-syntax": ["error", pgDynamicImport],
    },
  },
  {
    // TEN-10, app code. The exceptions build the pool and Better Auth's adapter (the system module's
    // configuration, spec "System module"); tests reach the database directly to set up and inspect it.
    files: ["apps/web/**/*.{ts,tsx,mts,cts,js,mjs}"],
    ignores: [
      "apps/web/src/db/**",
      "apps/web/src/lib/auth/config.ts",
      "apps/web/src/lib/auth/server.ts",
      "apps/web/src/lib/auth/cli-config.ts",
      "apps/web/src/test/**",
      "apps/web/**/*.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [coreSourceImport, pgImport, { regex: directDbSource, message: directDbMessage }] },
      ],
      "no-restricted-syntax": [
        "error",
        ...workspaceContextSyntax,
        pgDynamicImport,
        { selector: `ImportExpression[source.value=/${directDbSource.replaceAll("/", "\\/")}/i]`, message: directDbMessage },
        { selector: `ImportExpression[source.value=/${dbClientSource.replaceAll("/", "\\/")}/]`, message: dbClientMessage },
      ],
    },
  },
  {
    // TEN-10: database drivers only in src/db and tests (PR #43 Round 1 P2). The worker opens its crm_app pool
    // through the system module (openDatabase) since Phase 1 PR 5, so worker.ts has no exemption.
    files: ["apps/web/**/*.{ts,tsx,mts,cts,js,mjs}"],
    ignores: ["apps/web/src/db/**", "apps/web/src/test/**", "apps/web/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [{ regex: dbClientSource, message: dbClientMessage, allowTypeImports: true }] },
      ],
    },
  },
  {
    // AUTH-01: every server action goes through action() or is a named Better Auth forwarder
    // (apps/web/eslint/forwarding-actions.mjs). The rule follows the "use server" directive, so it runs on every
    // file and is a no-op without one.
    files: ["apps/web/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    plugins: { crm: { rules: { "server-action-wrapper": serverActionWrapper } } },
    rules: { "crm/server-action-wrapper": "error" },
  },
  {
    // TEN-10 inside src/db: only the system module (and the schema, the client and the role bootstrap)
    // imports the system tables.
    files: ["apps/web/src/db/**/*.{ts,tsx,mts,cts,js,mjs}"],
    ignores: [
      "apps/web/src/db/system/**",
      "apps/web/src/db/schema/**",
      "apps/web/src/db/client.ts",
      "apps/web/src/db/bootstrap.ts",
      "apps/web/src/db/**/*.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            coreSourceImport,
            pgImport,
            { regex: String.raw`(^|/)schema/(auth|system)${moduleSuffix}$`, message: systemSchemaMessage },
            { regex: String.raw`(^|/)schema(/index)?${moduleSuffix}$`, importNames: systemSchemaExports, message: systemSchemaMessage },
          ],
        },
      ],
    },
  },
);
