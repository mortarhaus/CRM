// Auth logs carry no personal data and no secret (UNI-09; plan Task 31 R13). A failed query's message holds its
// SQL and its parameters (drizzle-orm DrizzleQueryError: "Failed query: …\nparams: …"), so tokens, emails, user
// agents and IPs; an error is therefore logged as its name and SQLSTATE only, and a message as its first line.

function sqlStateOf(error: unknown): string | undefined {
  const { code, cause } = (error ?? {}) as { code?: unknown; cause?: { code?: unknown } };
  if (typeof cause?.code === "string") return cause.code;
  return typeof code === "string" ? code : undefined;
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const state = sqlStateOf(error);
  return state ? `${error.name} (${state})` : error.name;
}

// What a server-side `auth.api` caller receives for a failure that is not Better Auth's own APIError: the
// SQLSTATE stays (on `cause.code`, as drizzle-orm puts it), the message with the query and its parameters does not.
export class AuthRequestFailed extends Error {
  override readonly cause: { code: string | undefined };

  constructor(error: unknown) {
    super("auth request failed");
    this.name = "AuthRequestFailed";
    this.cause = { code: sqlStateOf(error) };
  }
}

function safeMessage(message: string): string {
  const firstLine = message.split("\n", 1)[0] ?? "";
  return firstLine.startsWith("Failed query") ? "database query failed" : firstLine;
}

export function logAuthFailure(error: unknown): void {
  console.error(`[auth] request failed: ${describe(error)}`);
}

// Better Auth's `logger.log`: replaces its console output.
export function logAuth(level: "info" | "warn" | "error" | "debug", message: string, ...args: unknown[]): void {
  const details = args.filter((arg) => arg instanceof Error).map(describe);
  const line = `[auth] ${level}: ${safeMessage(message)}${details.length > 0 ? ` (${details.join(", ")})` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
