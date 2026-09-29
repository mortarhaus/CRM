import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/packages/*/src/**"],
              message: "Import core through its package exports (for example @crm/core/password), not its source files.",
            },
          ],
        },
      ],
    },
  },
);
