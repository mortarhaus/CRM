import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // FE-70: every spec runs at a mobile, an intermediate and a desktop width.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-320", use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 640 } } },
  ],
  webServer: externalBaseURL
    ? undefined
    : [
        {
          command: "pnpm dev",
          url: "http://localhost:3000/api/health",
          reuseExistingServer: true,
          timeout: 120_000,
          // The app reads the client IP from X-Forwarded-For, which each test sets to its own address (e2e/fixtures.ts),
          // so the per-IP limits of one test never spend another's. docker/compose.dev.yml sets the same for the image.
          env: { TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for" },
        },
        {
          // The worker sends the test email (e2e/test-email.spec.ts) to the dev Mailpit. Its email settings are set
          // here, for this process only: `.env` is loaded by the web process too, which never gets them (DECISIONS
          // 2026-11-01, Task 27). Values already in the environment win over `--env-file`.
          command: "pnpm worker:dev",
          wait: { stdout: /"msg":"worker ready"/ },
          timeout: 60_000,
          env: { EMAIL_PROVIDER: "smtp", SMTP_URL: "smtp://127.0.0.1:1025", EMAIL_FROM: "CRM Dev <dev@localhost>" },
        },
      ],
});
