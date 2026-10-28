import { readFileSync } from "node:fs";
import { build } from "esbuild";

const result = await build({
  entryPoints: {
    worker: "worker.ts",
    migrate: "migrate.ts",
    bootstrap: "scripts/bootstrap-roles.ts",
    "retry-job": "scripts/retry-job.ts",
  },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  // pg's optional native binding, loaded only with `pg.native`, which pg-boss never uses (not installed).
  external: ["pg-native"],
  metafile: true,
  logLevel: "info",
});

// Bundle checks (plan Task 18; docs/DECISIONS.md 2026-10-27). They fail the build.
const failures = [];
const outputs = Object.entries(result.metafile.outputs);
const inputsOf = (name) => Object.keys(outputs.find(([file]) => file === `dist/${name}.mjs`)?.[1].inputs ?? {});

// 1. UNI-04: node-postgres reaches a bundle only through pg-boss. Every import of a pg-family package comes from
//    pg-boss or from the pg family itself.
const pgFamily = /node_modules\/(pg|pg-pool|pg-protocol|pg-types|pg-connection-string|pg-cloudflare|pg-int8|pgpass|postgres-array|postgres-bytea|postgres-date|postgres-interval|split2)\//;
const pgBoss = /node_modules\/pg-boss\//;
for (const [importer, input] of Object.entries(result.metafile.inputs)) {
  if (pgBoss.test(importer) || pgFamily.test(importer)) continue;
  for (const imported of input.imports) {
    if (pgFamily.test(imported.path) || /^pg(-native|-pool|-cursor|-query-stream)?(\/|$)/.test(imported.path)) {
      failures.push(`${importer} imports ${imported.path}: pg is allowed only inside pg-boss`);
    }
  }
}

// 2. The worker bundle carries the patched pg-boss and the patched postgres.js (pnpm patchedDependencies).
const workerInputs = inputsOf("worker");
for (const [name, patched] of [
  ["pg-boss", "pg-boss@12.35.0_patch_hash="],
  ["postgres", "postgres@3.4.9_patch_hash="],
]) {
  const copies = workerInputs.filter((path) => path.includes(`/node_modules/${name}/`));
  if (copies.length === 0) failures.push(`dist/worker.mjs has no ${name} input`);
  const unpatched = copies.filter((path) => !path.includes(patched));
  if (unpatched.length > 0) failures.push(`dist/worker.mjs bundles an unpatched ${name}: ${unpatched[0]}`);
}

// 3. The patched code itself: start() creates the cron queue only when it is missing (unpatched, the createQueue call
//    is not behind a getQueue check). esbuild drops the patch's comment, so the check reads the code.
if (!/if \(!await this\.manager\.getQueue\(QUEUES\d*\.SEND_IT\)\) \{\s*await this\.manager\.createQueue\(QUEUES\d*\.SEND_IT\);/.test(readFileSync("dist/worker.mjs", "utf8"))) {
  failures.push("dist/worker.mjs: the pg-boss timekeeper is not the patched one (createQueue without the getQueue check)");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`bundle check: ${failure}`);
  process.exit(1);
}
console.log("bundle checks: pg only inside pg-boss; worker bundles the patched pg-boss and postgres.js");
