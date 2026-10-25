import { build } from "esbuild";

await build({
  entryPoints: { worker: "worker.ts", migrate: "migrate.ts", bootstrap: "scripts/bootstrap-roles.ts" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
