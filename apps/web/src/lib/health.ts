export interface HealthResult {
  status: 200 | 503;
  body: { status: "ok" | "error"; db: "ok" | "error" };
}

export async function checkHealth(pingDb: () => Promise<void>, timeoutMs = 2_000): Promise<HealthResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), timeoutMs);
  });
  try {
    await Promise.race([pingDb(), timeout]);
    return { status: 200, body: { status: "ok", db: "ok" } };
  } catch {
    return { status: 503, body: { status: "error", db: "error" } };
  } finally {
    clearTimeout(timer);
  }
}
