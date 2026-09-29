import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");

// The single .env lives at the repo root (shared with docker compose), not in apps/web.
loadEnvConfig(repoRoot);

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@crm/core"],
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
};

export default config;
