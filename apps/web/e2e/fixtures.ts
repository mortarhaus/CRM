import { randomBytes } from "node:crypto";
import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

// Every test gets its own client IP (plan PR 7): the app reads `X-Forwarded-For` (TRUSTED_CLIENT_IP_HEADER, set in
// playwright.config.ts for `pnpm dev` and in docker/compose.dev.yml for the image), so the per-IP limits of one test
// never spend another test's budget. The address is random in 10.0.0.0/8 rather than derived from the test id, so a
// rerun within an hour does not meet the sign-up row's 10 per hour that its earlier run spent. The page, its
// `page.request` and every context the test opens send it; it reaches the app only on a deployment with no edge in
// front (local dev and the CI image), which is the only place this suite runs.
export function testClientIp(): string {
  const [a = 0, b = 0, c = 0] = randomBytes(3);
  return `10.${a}.${b}.${c}`;
}

export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": testClientIp() });
  },
});
