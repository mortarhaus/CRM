import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

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
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.ts"],
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
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "@next/*"],
              message: "packages/core must not import framework code.",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*", "drizzle-kit", "postgres", "pg", "pg-boss", "better-auth", "better-auth/*"],
              message: "packages/core must not import database or auth code.",
            },
            {
              group: ["@crm/web", "@crm/web/*", "@crm/ext-*"],
              message: "packages/core must not import app or extension code.",
            },
          ],
        },
      ],
    },
  },
);
