import { z } from "zod";

const postgresUrl = z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), {
  error: "must be a postgres:// URL",
});

const envSchema = z.object({
  DEPLOYMENT_MODE: z.enum(["saas", "selfhost"]),
  APP_URL: z.url(),
  AUTH_SECRET: z.string().min(32, { error: "must be at least 32 characters" }),
  DATABASE_URL: postgresUrl,
  DATABASE_MIGRATOR_URL: postgresUrl,
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  override name = "EnvError";
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
  throw new EnvError(
    ["Invalid environment configuration:", ...lines, "Copy .env.example to .env and set every value."].join("\n"),
  );
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
