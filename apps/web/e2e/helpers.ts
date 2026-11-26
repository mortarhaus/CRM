import { expect, type Locator, type Page, type Route } from "@playwright/test";
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

// Answers the onboarding questions as the new workspace's Owner (Phase 2 plan Task 8): the country, then No to the
// SST/GST question unless `registrationNo` is given. Ends where the app sends a set-up Owner (/workspaces).
export async function completeOnboarding(
  page: Page,
  country: "Malaysia" | "Singapore" = "Malaysia",
  registrationNo?: string,
): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel(country, { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\?country=(MY|SG)$/);
  if (registrationNo !== undefined) {
    await page.getByLabel("Yes", { exact: true }).check();
    await page.getByLabel(/registration number$/).first().fill(registrationNo);
  }
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
}

// Creates a workspace from /workspaces (its creator is the Owner) and completes its onboarding.
export async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await completeOnboarding(page);
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText(name);
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

// Below md the workspace switcher and Sign out are in the menu drawer; from md up they are in the top bar. Opens the
// drawer when the menu button shows (mobile-320) and does nothing otherwise. Each control is rendered in both places, one
// of them hidden, so tests find them by role, which skips hidden elements.
export async function openShellMenu(page: Page): Promise<void> {
  const menuButton = page.getByRole("button", { name: "Open menu" });
  if (!(await menuButton.isVisible())) return;
  const drawer = page.getByRole("dialog", { name: "Menu" });
  if (!(await drawer.isVisible())) await menuButton.click();
  await expectDrawerOpen(drawer);
}

// Waits for the slide-in to end: with JavaScript off, a click started mid-slide can wait forever for the element to be
// stable in headless Chromium (no frames are produced once the transition ends).
export async function expectDrawerOpen(drawer: Locator): Promise<void> {
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("translate", "0px");
}

// The open drawer is modal: the page behind it cannot be used until it closes.
export async function closeShellMenu(page: Page): Promise<void> {
  const drawer = page.getByRole("dialog", { name: "Menu" });
  if (!(await drawer.isVisible())) return;
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
}

export function workspaceSwitcher(page: Page): Locator {
  return page.getByRole("combobox", { name: "Active workspace" });
}

// Switches from /workspaces and waits for the server-rendered marker, so the switch is saved.
export async function switchTo(page: Page, name: string): Promise<void> {
  await page.goto("/workspaces");
  await openShellMenu(page);
  await workspaceSwitcher(page).selectOption({ label: name });
  await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("(active)");
  await closeShellMenu(page);
}

export async function signOut(page: Page): Promise<void> {
  await openShellMenu(page);
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

declare global {
  interface Window {
    reportCspViolation?: (violation: string) => void;
  }
}

// Every document of the page reports to the test, before any page script runs (init scripts and exposed functions
// are not subject to the page's CSP). Console CSP errors are collected too.
export async function recordCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction("reportCspViolation", (violation: string) => violations.push(violation));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      window.reportCspViolation?.(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}
