// Smoke check: `pnpm dev` with only the root .env (nothing exported in the shell) must serve
// GET /api/auth/ok with 200 {"ok":true}. Run from the repo root: `pnpm smoke:auth-route`.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

const REPO_ROOT = path.join(__dirname, "../../..");
const SCRUBBED_VARS = ["DATABASE_URL", "AUTH_SECRET", "APP_URL", "DATABASE_MIGRATOR_URL", "DEPLOYMENT_MODE", "NODE_ENV"];
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;
const KILL_GRACE_MS = 5_000;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("no port"))));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const port = await freePort();
  // Cast: Next's types declare NODE_ENV as always present on ProcessEnv, but this child env
  // deliberately omits it (and the app variables) so the root .env is the only source.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !SCRUBBED_VARS.includes(name))) as NodeJS.ProcessEnv;

  // detached: the child leads its own process group, so the whole tree (pnpm, next, its server
  // worker) can be killed with one signal to -pid.
  const child = spawn("pnpm", ["dev", "--port", String(port)], { cwd: REPO_ROOT, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
  let exited = false;
  child.once("exit", () => (exited = true));

  // Signal the whole process group, not just the pnpm leader: next's server worker can outlive it.
  const pid = child.pid;
  const signalGroup = (signal: NodeJS.Signals | 0): boolean => {
    if (pid === undefined) return false;
    try {
      process.kill(-pid, signal);
      return true;
    } catch {
      return false; // No process left in the group.
    }
  };
  const killTree = async (): Promise<void> => {
    if (!signalGroup("SIGTERM")) return;
    const deadline = Date.now() + KILL_GRACE_MS;
    while (signalGroup(0) && Date.now() < deadline) await sleep(100);
    signalGroup("SIGKILL");
  };
  const onSignal = (): void => void killTree().finally(() => process.exit(130));
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  const url = `http://127.0.0.1:${port}/api/auth/ok`;
  try {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let response: Response | undefined;
    while (!response) {
      if (exited) throw new Error("`pnpm dev` exited before it answered");
      if (Date.now() > deadline) throw new Error(`no answer from ${url} within ${READY_TIMEOUT_MS / 1000}s`);
      response = await fetch(url).catch(() => undefined);
      if (!response) await sleep(POLL_INTERVAL_MS);
    }
    const body = await response.text();
    if (response.status !== 200) throw new Error(`GET ${url} returned ${response.status}, expected 200`);
    if (body !== JSON.stringify({ ok: true })) throw new Error(`GET ${url} returned an unexpected body`);
    console.log(`PASS: GET /api/auth/ok -> 200 ${body} (pnpm dev, root .env only)`);
  } catch (error) {
    // The dev server log names invalid variables only, never their values (apps/web/src/lib/env.ts).
    console.error(output.split("\n").slice(-40).join("\n"));
    console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await killTree();
  }
}

void main();
