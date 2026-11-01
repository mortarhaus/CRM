import { type BetterAuthOptions, betterAuth } from "better-auth";

// Spec "Better Auth endpoints" → "Enabled in Phase 1"; plan Task 24. The paths the installed Better Auth (1.7.14)
// exposes for those features, read from its endpoints (`Object.values(auth.api)`, the `path` of each). Every other
// path is disabled (`disabledPaths`, computed from the built options) and answered 404 by handleAuthRequest, so an
// upgrade's new path is unreachable until it is classified here and in enabled-paths.test.ts.
export const PHASE1_ENABLED_AUTH_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/change-password",
  "/update-user",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/generate-backup-codes",
  "/organization/create",
  "/organization/update",
  "/organization/set-active",
  "/organization/list",
  // Not a feature: Better Auth's liveness answer `{"ok":true}`, no data. `pnpm smoke:auth-route` and the
  // `next start` tests read it.
  "/ok",
] as const;

const ENABLED: ReadonlySet<string> = new Set(PHASE1_ENABLED_AUTH_PATHS);

export function isEnabledAuthPath(path: string): boolean {
  return ENABLED.has(path);
}

let cachedPaths: readonly string[] | undefined;

// Every endpoint path an instance built from these options exposes. The set depends only on the plugins, the same
// for every instance of this app, so it is read once, from an instance with no database (never called).
export function endpointPathsOf(options: BetterAuthOptions): readonly string[] {
  if (!cachedPaths) {
    const probe = betterAuth({ ...options, database: undefined, disabledPaths: [], logger: { disabled: true } });
    const paths = Object.values(probe.api as Record<string, { path?: unknown }>)
      .map((endpoint) => endpoint.path)
      .filter((path): path is string => typeof path === "string");
    cachedPaths = [...new Set(paths)].sort();
  }
  return cachedPaths;
}

export function disabledPathsOf(paths: readonly string[]): string[] {
  return paths.filter((path) => !ENABLED.has(path));
}
