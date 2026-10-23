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

const envSchema = withAppUrlRule(webFields);
const workerEnvSchema = withAppUrlRule(webFields.extend({ DATABASE_WORKER_URL: postgresUrl }));

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

export function parseBootstrapEnv(source: Record<string, string | undefined>): BootstrapEnv {
  return parseWith(bootstrapEnvSchema, source);
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
