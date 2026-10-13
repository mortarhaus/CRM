import { z } from "zod";
import { isHttpsUrl, isLoopbackUrl } from "./origin";

const postgresUrl = z.url().refine((value) => /^postgres(ql)?:\/\//.test(value), {
  error: "must be a postgres:// URL",
});

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DEPLOYMENT_MODE: z.enum(["saas", "selfhost"]),
    APP_URL: z.url(),
    AUTH_SECRET: z.string().min(32, { error: "must be at least 32 characters" }),
    DATABASE_URL: postgresUrl,
    DATABASE_MIGRATOR_URL: postgresUrl,
  })
  .refine((env) => env.NODE_ENV !== "production" || isHttpsUrl(env.APP_URL) || isLoopbackUrl(env.APP_URL), {
    path: ["APP_URL"],
    error: "must be an https:// URL in production (only localhost, 127.0.0.1 and ::1 may use http)",
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
