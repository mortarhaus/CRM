// One id per `vitest run`, inherited by every worker: buildWeb (next-server.ts) builds the app once per run, so a
// second test file never rebuilds .next under a first file's running `next start` processes.
export default function setup(): void {
  process.env.CRM_TEST_RUN_ID ??= `${process.pid}-${Date.now()}`;
}
