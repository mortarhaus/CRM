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
    : {
        command: "pnpm dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
