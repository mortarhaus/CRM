import { z } from "zod";
import type { StorageConfig } from "../adapters/storage/types";
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

// Object storage (Phase 2 plan Task 10; docs/runbooks/phase-2-storage.md): S3, R2 or MinIO. Web only for now (the
// logo upload and its serve route). All four required values are set together or not at all: none means storage is
// off (uploads are refused, nothing is served) and the app still starts; a partial set stops it at start.
// STORAGE_ENDPOINT is unset for AWS S3 itself. The two keys are secrets and never logged (UNI-09).
const storageFields = {
  STORAGE_ENDPOINT: z
    .url()
    .refine((value) => /^https?:\/\//.test(value), { error: "must be an http:// or https:// URL" })
    .optional(),
  STORAGE_REGION: z.string().min(1).optional(),
  STORAGE_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, { error: "must be an S3 bucket name (3-63 lower-case letters, digits, dots or hyphens)" })
    .optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_FORCE_PATH_STYLE: z.enum(["true", "false"], { error: "must be true or false" }).optional(),
};
const STORAGE_REQUIRED = ["STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const;
const STORAGE_ALL = [...STORAGE_REQUIRED, "STORAGE_ENDPOINT", "STORAGE_FORCE_PATH_STYLE"] as const;

const envSchema = withAppUrlRule(
  webFields.extend({ TRUSTED_CLIENT_IP_HEADER: z.enum(TRUSTED_CLIENT_IP_HEADERS).optional(), ...storageFields }),
)
  .refine((env) => env.NODE_ENV !== "production" || env.TRUSTED_CLIENT_IP_HEADER !== undefined, {
    path: ["TRUSTED_CLIENT_IP_HEADER"],
    error: "must be set in production (cf-connecting-ip, x-forwarded-for or none)",
  })
  .superRefine((env, context) => {
    if (!STORAGE_ALL.some((name) => env[name] !== undefined)) return;
    for (const name of STORAGE_REQUIRED) {
      if (env[name] === undefined) context.addIssue({ code: "custom", path: [name], message: "must be set when any STORAGE_* value is set" });
    }
  });
// Email is sent only by the worker (plan Task 26), so these are worker-only: the web container never gets them, and
// RESEND_API_KEY lives only in the worker's environment. EMAIL_FROM is one address with a display name, on one line.
export const EMAIL_PROVIDERS = ["smtp", "resend"] as const;
const emailFields = {
  EMAIL_PROVIDER: z.enum(EMAIL_PROVIDERS),
  EMAIL_FROM: z.string().regex(/^[^<>\r\n]+ <[^\s<>@]+@[^\s<>@]+>$/, {
    error: "must be a display name and an address, for example: CRM <crm@example.com>",
  }),
  SMTP_URL: z
    .url()
    .refine((value) => /^smtps?:\/\//.test(value), { error: "must be an smtp:// or smtps:// URL" })
    .optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
};

const workerEnvSchema = withAppUrlRule(webFields.extend({ DATABASE_WORKER_URL: postgresUrl, ...emailFields }))
  .refine((env) => env.EMAIL_PROVIDER !== "smtp" || env.SMTP_URL !== undefined, {
    path: ["SMTP_URL"],
    error: "must be set when EMAIL_PROVIDER is smtp",
  })
  .refine((env) => env.EMAIL_PROVIDER !== "resend" || env.RESEND_API_KEY !== undefined, {
    path: ["RESEND_API_KEY"],
    error: "must be set when EMAIL_PROVIDER is resend",
  });
// The retry admin command (scripts/retry-job.ts) opens only the crm_worker connection.
const jobsAdminEnvSchema = z.object({ DATABASE_WORKER_URL: postgresUrl });
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
export type EmailEnv = Pick<WorkerEnv, "EMAIL_PROVIDER" | "EMAIL_FROM" | "SMTP_URL" | "RESEND_API_KEY">;
export type JobsAdminEnv = z.infer<typeof jobsAdminEnvSchema>;
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

export function parseJobsAdminEnv(source: Record<string, string | undefined>): JobsAdminEnv {
  return parseWith(jobsAdminEnvSchema, source);
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

// The storage adapter's settings, or null when storage is not configured (see storageFields).
export function storageConfig(env: Env): StorageConfig | null {
  const { STORAGE_REGION: region, STORAGE_BUCKET: bucket, STORAGE_ACCESS_KEY_ID: accessKeyId, STORAGE_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (region === undefined || bucket === undefined || accessKeyId === undefined || secretAccessKey === undefined) return null;
  return {
    endpoint: env.STORAGE_ENDPOINT,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true",
  };
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
