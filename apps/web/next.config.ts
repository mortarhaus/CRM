import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { LOGO_MAX_BYTES } from "@crm/core/security";
import { SECURITY_HEADER_ROUTES } from "./src/lib/security-headers";

const repoRoot = path.join(__dirname, "../..");

// The single .env lives at the repo root (shared with docker compose), not in apps/web.
// Next calls loadEnvConfig(apps/web) before it runs this file, and @next/env caches that first
// result, so a plain loadEnvConfig(repoRoot) here is a no-op. forceReload (4th argument) bypasses
// the cache, but first resets process.env to Next's startup snapshot; the Object.assign puts back
// anything set since (e.g. Next's RUST_MIN_STACK). Variables already set in the shell still win
// over the file. Next adds the variables set here to its initial env, so its own later env reloads
// keep them. A change to the root .env needs a dev server restart.
const envBeforeRootLoad = { ...process.env };
loadEnvConfig(repoRoot, process.env.NODE_ENV === "development", undefined, true);
Object.assign(process.env, envBeforeRootLoad);

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@crm/core"],
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  // The page CSP comes from src/proxy.ts (a nonce per request); docs/DECISIONS.md records where each header is set.
  headers: async () => SECURITY_HEADER_ROUTES,
  experimental: {
    serverActions: {
      // The largest upload a server action takes (the logo, Phase 2 Task 12) plus room for the multipart framing
      // and the other fields; Next's default is 1 MB. The action checks the file's own size and bytes again.
      bodySizeLimit: LOGO_MAX_BYTES + 64 * 1024,
    },
  },
};

export default config;
