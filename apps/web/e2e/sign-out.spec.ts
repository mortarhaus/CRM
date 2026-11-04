import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { failServerActions, openShellMenu, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

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

// The sign-out form posts to a server action. A refusal from Better Auth is covered by the unit tests
// (signOutAction); here the action post itself fails.
for (const [label, failure] of [
  ["a network error", "network"],
  ["a server error", "server"],
] as const) {
  test(`sign-out that fails with ${label} keeps the user on the page and can be retried`, async ({ page }) => {
    await signedInUser(page);
    const restore = await failServerActions(page, failure);
    await openShellMenu(page);

    const signOutButton = page.getByRole("button", { name: "Sign out" });
    await signOutButton.click();

    await expect(page.getByRole("alert").filter({ hasText: SIGN_OUT_FAILED })).toBeVisible();
    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(signOutButton).toBeEnabled();
    await expect(signOutButton).toBeFocused();
    expect(await serverSession(page)).not.toBeNull();

    // A second failure is handled the same way.
    await signOutButton.click();
    await expect(page.getByRole("alert").filter({ hasText: SIGN_OUT_FAILED })).toBeVisible();
    await expect(signOutButton).toBeFocused();

    await restore();
    await signOutButton.click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(await serverSession(page)).toBeNull();
  });
}

test("a normal sign-out clears the server session and lands on sign in", async ({ page }) => {
  await signedInUser(page);
  await openShellMenu(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await serverSession(page)).toBeNull();

  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in$/);
});
