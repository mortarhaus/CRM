import { expect, test, type Page } from "@playwright/test";
import { respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

const SIGN_OUT_ENDPOINT = "**/api/auth/sign-out";
const SIGN_OUT_FAILED = "We couldn't sign you out. Try again.";

async function signedInUser(page: Page): Promise<void> {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
}

async function serverSession(page: Page): Promise<unknown> {
  return (await page.request.get("/api/auth/get-session")).json();
}

for (const [failure, fail] of [
  ["a network error", (page: Page) => page.route(SIGN_OUT_ENDPOINT, (route) => route.abort("failed"))],
  ["a server error", (page: Page) => page.route(SIGN_OUT_ENDPOINT, (route) => route.fulfill({ status: 500 }))],
] as const) {
  test(`sign-out that fails with ${failure} keeps the user on the page and can be retried`, async ({ page }) => {
    await signedInUser(page);
    await fail(page);

    const signOutButton = page.getByRole("button", { name: "Sign out" });
    await signOutButton.click();

    await expect(page.getByRole("alert").filter({ hasText: SIGN_OUT_FAILED })).toBeVisible();
    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(signOutButton).toBeEnabled();
    await expect(signOutButton).toBeFocused();
    expect(await serverSession(page)).not.toBeNull();

    await page.unroute(SIGN_OUT_ENDPOINT);
    await signOutButton.click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(await serverSession(page)).toBeNull();
  });
}

test("a normal sign-out clears the server session and lands on sign in", async ({ page }) => {
  await signedInUser(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await serverSession(page)).toBeNull();

  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in$/);
});
