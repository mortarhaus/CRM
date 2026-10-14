import { expect, test } from "@playwright/test";
import { PASSWORD, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
});

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the root page sends signed-out visitors to sign in and signed-in visitors to their workspaces", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);

  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces$/);
});

test("a new user can sign up and then sign in", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page.getByRole("status")).toContainText("Sign in to continue");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
});

test("signing up twice with one email reveals nothing and keeps the original password", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email, PASSWORD, "Original Owner");
  await signUp(page, email, "a-different-password-99", "Impostor");

  await signIn(page, email, "a-different-password-99");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/workspaces$/);
});
