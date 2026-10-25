import { defineConfig } from "vitest/config";

// postgres.js 3.4.9: when a backend is terminated during a transaction, begin() sends its ROLLBACK on the closed
// connection and the write fails on a later tick with this TypeError (connection.js nextWrite, socket null). The
// database side is already rolled back. Only the auth tests that terminate a backend on purpose (plan Task 31,
// "connection killed") reach it; any other unhandled error still fails the run.
function isDriverWriteAfterClose(error: Error & { stack?: string }): boolean {
  return (
    error.name === "TypeError" &&
    error.message === "Cannot read properties of null (reading 'write')" &&
    /postgres\/src\/connection\.js/.test(error.stack ?? "") &&
    /nextWrite/.test(error.stack ?? "")
  );
}

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.{ts,mts}", "apps/*/vitest.config.{ts,mts}"],
    onUnhandledError: (error) => !isDriverWriteAfterClose(error),
  },
});
