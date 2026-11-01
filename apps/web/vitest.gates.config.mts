import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The gates (plan Task 20): long real-time tests excluded from `pnpm test`, run by `pnpm test:gates` and in CI.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "web-gates",
    environment: "node",
    include: ["src/**/*.gate.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
