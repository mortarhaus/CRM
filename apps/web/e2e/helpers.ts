import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct horse battery staple 42";

export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

// Better Auth's built-in limiter (NODE_ENV=production only) allows 3 requests per 10 s per path
// on /sign-in*, /sign-up* and /two-factor/*. Set E2E_RATE_LIMITED=1 when testing the production image.
export async function respectRateLimit(page: Page): Promise<void> {
  if (process.env.E2E_RATE_LIMITED === "1") await page.waitForTimeout(11_000);
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
