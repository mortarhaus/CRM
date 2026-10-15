import type postgres from "postgres";

export interface WorkerHandle {
  stop(): Promise<void>;
}

type Log = (line: string) => void;

function info(log: Log, msg: string): void {
  log(JSON.stringify({ level: "info", msg }));
}

export async function startWorker(sql: postgres.Sql, log: Log = console.log): Promise<WorkerHandle> {
  await sql`select 1`;
  // No jobs until pg-boss lands in Phase 1; the timer keeps the process alive the way a consumer loop will.
  const keepAlive = setInterval(() => {}, 60_000);
  info(log, "worker ready");
  return {
    async stop() {
      clearInterval(keepAlive);
      await sql.end({ timeout: 5 });
      info(log, "worker stopped");
    },
  };
}
