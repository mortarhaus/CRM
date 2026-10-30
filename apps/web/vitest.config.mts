import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The `@/*` path from tsconfig.json, for modules under test that import through it.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "web",
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // The gates run with `pnpm test:gates` (vitest.gates.config.mts).
    exclude: [...configDefaults.exclude, "**/*.gate.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
