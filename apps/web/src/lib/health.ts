type Check = "ok" | "error";

export interface HealthResult {
  status: 200 | 503;
  body: { status: Check; db: Check; queue: Check };
}

// Each check is bounded by the timeout; a failure reports "error" only, never the error text.
async function run(check: () => Promise<void>, timeoutMs: number): Promise<Check> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), timeoutMs);
  });
  try {
    await Promise.race([check(), timeout]);
    return "ok";
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(
  pingDb: () => Promise<void>,
  pingQueue: () => Promise<void>,
  timeoutMs = 2_000,
): Promise<HealthResult> {
  const [db, queue] = await Promise.all([run(pingDb, timeoutMs), run(pingQueue, timeoutMs)]);
  const healthy = db === "ok" && queue === "ok";
  return { status: healthy ? 200 : 503, body: { status: healthy ? "ok" : "error", db, queue } };
}
