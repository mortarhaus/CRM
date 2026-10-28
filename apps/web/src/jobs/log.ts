// Job logs carry no personal data and no secret (UNI-09): a pg-boss error, a failed query or a handler error, is
// logged as its name, its SQLSTATE and the queue only. A message can hold a statement's values (for example
// `invalid input syntax for type uuid: "<value>"`), so it is never logged. pg-boss emits some errors as plain
// objects spread from the original (`{ ...error, message, stack, queue }`), so both shapes are read.

export type Log = (line: string) => void;

function field(value: unknown, key: string): string | undefined {
  const found = (value ?? {}) as Record<string, unknown>;
  return typeof found[key] === "string" ? found[key] : undefined;
}

export function describeJobError(error: unknown): { error: string; code?: string; queue?: string } {
  const name = error instanceof Error ? error.name : (field(error, "name") ?? typeof error);
  const code = field(error, "code") ?? field((error as { cause?: unknown } | null)?.cause, "code");
  const queue = field(error, "queue");
  return { error: name, ...(code ? { code } : {}), ...(queue ? { queue } : {}) };
}

export function logInfo(log: Log, msg: string, extra: Record<string, string | number> = {}): void {
  log(JSON.stringify({ level: "info", msg, ...extra }));
}

export function logJobError(log: Log, msg: string, error: unknown): void {
  log(JSON.stringify({ level: "error", msg, ...describeJobError(error) }));
}
