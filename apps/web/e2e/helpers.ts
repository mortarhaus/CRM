import { expect, type Page, type Route } from "@playwright/test";
import type { TOTP } from "otpauth";
import { totpFromUri } from "../src/test/totp";

// Opens its own database connection, so it lives under src/test (TEN-10 lint).
export { setMemberRole } from "../src/test/member-role";

export const PASSWORD = "correct horse battery staple 42";

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

// Phase 0 waited out Better Auth's built-in 3 per 10 s. Phase 1 limits are on everywhere (10 per 60 s for sign-in,
// 10 per hour for sign-up, per client IP; docs/runbooks/phase-1-security.md) and every test has its own client IP
// (fixtures.ts), so no test comes near them; the wait stays behind E2E_RATE_LIMITED=1 as a margin for the image run.
export async function respectRateLimit(page: Page): Promise<void> {
  if (process.env.E2E_RATE_LIMITED === "1") await page.waitForTimeout(11_000);
}

// Server actions post to the page's own URL with a `Next-Action` header. Makes every such post fail as
// if the network dropped or the server broke, until the returned function is called.
export async function failServerActions(page: Page, failure: "network" | "server"): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const request = route.request();
    if (request.method() !== "POST" || !(await request.headerValue("next-action"))) return route.fallback();
    return failure === "network" ? route.abort("failed") : route.fulfill({ status: 500 });
  };
  await page.route("**/*", handler);
  return () => page.unroute("**/*", handler);
}

export async function signUp(page: Page, email: string, password = PASSWORD, name = "E2E Owner"): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/sign-in\?registered=1$/);
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

export async function startTotpEnrolment(page: Page): Promise<TOTP> {
  await page.getByRole("link", { name: "Security" }).click();
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const uri = (await page.getByTestId("totp-uri").textContent())?.trim() ?? "";
  return totpFromUri(uri);
}

export async function submitTotpCode(page: Page, code: string): Promise<void> {
  await page.getByLabel("Authentication code").fill(code);
  await page.getByRole("button", { name: "Verify and turn on" }).click();
}

export async function enrolTotp(page: Page): Promise<TOTP> {
  const totp = await startTotpEnrolment(page);
  await submitTotpCode(page, totp.generate());
  await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");
  return totp;
}

export async function completeTotpSignIn(page: Page, totp: TOTP): Promise<void> {
  await expect(page).toHaveURL(/\/two-factor$/);
  await page.getByLabel("Authentication code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
}

