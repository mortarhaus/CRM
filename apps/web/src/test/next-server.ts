import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `next start` processes and a test edge for the tests that must run the built app (plan Tasks 23 and 24).

const WEB_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const NEXT_BIN = path.join(WEB_ROOT, "node_modules/next/dist/bin/next");
const BUILD_LOCK = path.join(WEB_ROOT, ".next-test-build.lock");
// The run id (run-id.global.ts) of the last test build, inside .next.
const BUILD_STAMP = path.join(WEB_ROOT, ".next", "test-run-id");
const LOCK_STALE_MS = 10 * 60_000;
const READY_TIMEOUT_MS = 60_000;
// The app's variables; a child gets only the ones a test sets (the root .env fills nothing a test sets).
const APP_VARS = ["DATABASE_URL", "AUTH_SECRET", "APP_URL", "DATABASE_MIGRATOR_URL", "DEPLOYMENT_MODE", "TRUSTED_CLIENT_IP_HEADER"];
// The test runner's own markers: a child must run as production does (Better Auth reads TEST, see config.ts).
const RUNNER_VARS = /^(TEST|VITEST.*|NODE_ENV)$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let built = false;

// `pnpm --filter @crm/web build`, once per `vitest run` (run-id.global.ts): test files in parallel workers take turns
// at the lock, and a later one reuses the build instead of rewriting .next under the servers of an earlier one.
export async function buildWeb(): Promise<void> {
  if (built) return;
  for (;;) {
    try {
      mkdirSync(BUILD_LOCK);
      break;
    } catch {
      const age = Date.now() - (statSync(BUILD_LOCK, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > LOCK_STALE_MS) rmdirSync(BUILD_LOCK, { recursive: true } as never);
      await sleep(500);
    }
  }
  try {
    const runId = process.env.CRM_TEST_RUN_ID;
    let stamp: string | undefined;
    try {
      stamp = readFileSync(BUILD_STAMP, "utf8");
    } catch {
      stamp = undefined;
    }
    if (runId === undefined || stamp !== runId) {
      execFileSync("pnpm", ["--filter", "@crm/web", "build"], { cwd: WEB_ROOT, stdio: "ignore" });
      if (runId !== undefined) writeFileSync(BUILD_STAMP, runId);
    }
    built = true;
  } finally {
    rmdirSync(BUILD_LOCK);
  }
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

export interface NextServer {
  readonly port: number;
  readonly origin: string;
  // Everything the process printed (log lines are checked for the client-IP fallback warning).
  output(): string;
  stop(): Promise<void>;
}

export async function startNext(env: Record<string, string>): Promise<NextServer> {
  const port = await freePort();
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !APP_VARS.includes(name) && !RUNNER_VARS.test(name)),
  );
  const child: ChildProcess = spawn(process.execPath, [NEXT_BIN, "start", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: WEB_ROOT,
    env: { ...base, ...env, NODE_ENV: "production" } as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  let exited = false;
  child.once("exit", () => (exited = true));
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  for (;;) {
    if (exited) throw new Error(`next start exited:\n${output.slice(-2000)}`);
    if (Date.now() > deadline) throw new Error(`next start not ready:\n${output.slice(-2000)}`);
    const response = await fetch(`${origin}/api/auth/ok`).catch(() => undefined);
    if (response?.ok) break;
    await sleep(250);
  }
  return {
    port,
    origin,
    output: () => output,
    async stop() {
      if (exited) return;
      const done = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await Promise.race([done, sleep(5_000)]);
      if (!exited) child.kill("SIGKILL");
      await done;
    },
  };
}

// Test-only request headers the edge reads and removes: which backend, and what the edge itself sees.
export const EDGE_BACKEND_HEADER = "x-test-backend";
export const EDGE_PEER_HEADER = "x-test-edge-peer";
export const EDGE_MODE_HEADER = "x-test-edge-mode";
export type EdgeMode = "set" | "omit" | "malformed";

export interface TestEdge {
  readonly origin: string;
  backends: NextServer[];
  close(): Promise<void>;
}

// A tiny trusted edge (Cloudflare or Caddy): it overwrites the configured header with the peer address it saw
// (EDGE_PEER_HEADER stands in for the TCP peer), passes every other header through unchanged (forged ones included),
// and proxies to the backend the request names. Host stays the edge's, as with a real reverse proxy.
export async function startEdge(trustedHeader: string, backends: NextServer[]): Promise<TestEdge> {
  const edge: TestEdge = { origin: "", backends, close: async () => {} };
  const server = http.createServer((incoming, outgoing) => {
    const testHeaders = new Set<string>([EDGE_BACKEND_HEADER, EDGE_PEER_HEADER, EDGE_MODE_HEADER, trustedHeader]);
    const headers = Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => !testHeaders.has(name)));
    const backend = edge.backends[Number(incoming.headers[EDGE_BACKEND_HEADER] ?? 0)];
    const peer = String(incoming.headers[EDGE_PEER_HEADER] ?? "203.0.113.1");
    const mode = (incoming.headers[EDGE_MODE_HEADER] ?? "set") as EdgeMode;
    if (mode === "set") headers[trustedHeader] = peer;
    else if (mode === "malformed") headers[trustedHeader] = "not-an-address";
    if (!backend) {
      outgoing.writeHead(502).end();
      return;
    }
    const proxied = http.request(
      { host: "127.0.0.1", port: backend.port, method: incoming.method, path: incoming.url, headers },
      (reply) => {
        outgoing.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(outgoing);
      },
    );
    proxied.on("error", () => outgoing.writeHead(502).end());
    incoming.pipe(proxied);
  });
  const port = await freePort();
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return Object.assign(edge, {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
