import { z } from "zod";
import { isHttpsUrl, isLoopbackUrl } from "./origin";

const postgresUrl = z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), {
  error: "must be a postgres:// URL",
});

const webFields = z.object({
  NODE_ENV: z.string().optional(),
  DEPLOYMENT_MODE: z.enum(["saas", "selfhost"]),
  APP_URL: z.url(),
  AUTH_SECRET: z.string().min(32, { error: "must be at least 32 characters" }),
  DATABASE_URL: postgresUrl,
  DATABASE_MIGRATOR_URL: postgresUrl,
});

function withAppUrlRule<T extends z.infer<typeof webFields>>(schema: z.ZodType<T>) {
  return schema.refine((env) => env.NODE_ENV !== "production" || isHttpsUrl(env.APP_URL) || isLoopbackUrl(env.APP_URL), {
    path: ["APP_URL"],
    error: "must be an https:// URL in production (only localhost, 127.0.0.1 and ::1 may use http)",
  });
}

// Spec "Rate limits" → "Client IP": the one header the deployment's edge sets to the client address. Own SaaS
// (Cloudflare Tunnel) reads cf-connecting-ip; self-host (Caddy or similar) reads x-forwarded-for. Required in
// production; `none` (dev and tests without an edge) gives every request the shared placeholder address.
export const TRUSTED_CLIENT_IP_HEADERS = ["cf-connecting-ip", "x-forwarded-for", "none"] as const;
export type TrustedClientIpHeader = (typeof TRUSTED_CLIENT_IP_HEADERS)[number];

const envSchema = withAppUrlRule(
  webFields.extend({ TRUSTED_CLIENT_IP_HEADER: z.enum(TRUSTED_CLIENT_IP_HEADERS).optional() }),
).refine((env) => env.NODE_ENV !== "production" || env.TRUSTED_CLIENT_IP_HEADER !== undefined, {
  path: ["TRUSTED_CLIENT_IP_HEADER"],
  error: "must be set in production (cf-connecting-ip, x-forwarded-for or none)",
});
const workerEnvSchema = withAppUrlRule(webFields.extend({ DATABASE_WORKER_URL: postgresUrl }));
// `migrate.mjs` runs first in every app container (docker/entrypoint.sh: web and worker), so it reads only its own
// connection and never a setting that only one of those containers has (TRUSTED_CLIENT_IP_HEADER is web-only).
const migrateEnvSchema = z.object({ DATABASE_MIGRATOR_URL: postgresUrl });

// Printable ASCII only: the bootstrap hashes the password itself (SCRAM-SHA-256), and SASLprep is the
// identity on these characters, so the stored verifier matches what Postgres would compute.
const rolePassword = z
  .string()
  .min(16, { error: "must be at least 16 characters" })
  .regex(/^[\x20-\x7E]+$/, { error: "must use printable ASCII characters only" });
const bootstrapEnvSchema = z.object({
  DATABASE_ADMIN_URL: postgresUrl,
  CRM_MIGRATOR_PASSWORD: rolePassword,
  CRM_APP_PASSWORD: rolePassword,
  CRM_WORKER_PASSWORD: rolePassword,
  CRM_PURGE_PASSWORD: rolePassword.optional(),
});

export type Env = z.infer<typeof envSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;
export type MigrateEnv = z.infer<typeof migrateEnvSchema>;

export class EnvError extends Error {
  override name = "EnvError";
}

function parseWith<T>(schema: z.ZodType<T>, source: Record<string, string | undefined>): T {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new EnvError(
    ["Invalid environment configuration:", ...lines, "Copy .env.example to .env and set every value."].join("\n"),
  );
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseWith(envSchema, source);
}

export function parseWorkerEnv(source: Record<string, string | undefined>): WorkerEnv {
  return parseWith(workerEnvSchema, source);
}

export function parseMigrateEnv(source: Record<string, string | undefined>): MigrateEnv {
  return parseWith(migrateEnvSchema, source);
}

// The container role the entrypoint passes to `migrate.mjs`: the whole schema of that container is checked at start
// (so a misconfigured container exits 1 before it listens or works), and the migration reads only its connection.
export type ContainerRole = "web" | "worker";

export function migrateEnvFor(role: ContainerRole | undefined, source: Record<string, string | undefined>): MigrateEnv {
  if (role === "web") parseEnv(source);
  else if (role === "worker") parseWorkerEnv(source);
  return parseMigrateEnv(source);
}

export function parseBootstrapEnv(source: Record<string, string | undefined>): BootstrapEnv {
  return parseWith(bootstrapEnvSchema, source);
}

export function trustedClientIpHeader(env: Env): TrustedClientIpHeader {
  return env.TRUSTED_CLIENT_IP_HEADER ?? "none";
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

let cachedWorker: WorkerEnv | undefined;

export function getWorkerEnv(): WorkerEnv {
  cachedWorker ??= parseWorkerEnv(process.env);
  return cachedWorker;
}
