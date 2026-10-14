import { WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { expect, test, type Page } from "@playwright/test";
import { totpFromUri, wrongTotpCode } from "../src/test/totp";
import { expectAccessible, expectVisibleFocus, tabTo } from "./a11y";
import {
  PASSWORD,
  respectRateLimit,
  signIn,
  signUp,
  startTotpEnrolment,
  submitTotpCode,
  uniqueEmail,
} from "./helpers";

// The longest name the form accepts, as one unbroken word to stress wrapping.
const LONGEST_WORKSPACE_NAME = "Supercalifragilisticexpialidocious-Creative-Partnership-Studio-International-Ltd"
  .padEnd(WORKSPACE_NAME_MAX_LENGTH, "s")
  .slice(0, WORKSPACE_NAME_MAX_LENGTH);

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText(name);
}

async function serverSession(page: Page): Promise<unknown> {
  return (await page.request.get("/api/auth/get-session")).json();
}

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
});

test.describe("axe scan, light and dark, no horizontal overflow", () => {
  test("sign-up and sign-in pages in their initial, error and registered states", async ({ page }) => {
    await page.goto("/sign-up");
    await expectAccessible(page, "/sign-up initial");

    await page.route("**/api/auth/sign-up/email", (route) => route.fulfill({ status: 500 }));
    await page.getByLabel("Name", { exact: true }).fill("Error Case");
    await page.getByLabel("Email", { exact: true }).fill(uniqueEmail());
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "We couldn't create your account. Check your details and try again.",
    );
    await expectAccessible(page, "/sign-up server error");
    await page.unroute("**/api/auth/sign-up/email");

    await page.goto("/sign-in");
    await expectAccessible(page, "/sign-in initial");

    await signIn(page, uniqueEmail(), "not-the-password-1");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
    await expectAccessible(page, "/sign-in wrong password");

    await page.goto("/sign-in?registered=1");
    await expect(page.getByRole("status")).toContainText("Sign in to continue");
    await expectAccessible(page, "/sign-in?registered=1");
  });

  test("security page with 2FA off, mid-enrolment and on; two-factor page; workspaces", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(page.getByText("You have no workspaces yet.")).toBeVisible();
    await expectAccessible(page, "/workspaces empty");

    await page.getByRole("link", { name: "Security" }).click();
    await expect(page.getByLabel("Current password")).toBeVisible();
    await expectAccessible(page, "/settings/security 2FA off");

    const totp = await startTotpEnrolment(page);
    await expectAccessible(page, "/settings/security mid-enrolment");
    await submitTotpCode(page, wrongTotpCode(totp));
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expectAccessible(page, "/settings/security mid-enrolment, wrong code");
    await submitTotpCode(page, totp.generate());
    await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");
    await expectAccessible(page, "/settings/security 2FA on");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await respectRateLimit(page);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/two-factor$/);
    await expectAccessible(page, "/two-factor initial");
    await page.getByLabel("Authentication code").fill(wrongTotpCode(totp));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expectAccessible(page, "/two-factor wrong code");
    await page.getByLabel("Authentication code").fill(totp.generate());
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(/\/workspaces$/);

    await createWorkspace(page, "Studio Alpha");
    await createWorkspace(page, LONGEST_WORKSPACE_NAME);
    await expect(page.getByLabel("Active workspace").locator("option:checked")).toHaveText(LONGEST_WORKSPACE_NAME);
    await expectAccessible(page, "/workspaces two workspaces, longest name active");

    await page.route("**/api/auth/organization/create", (route) => route.fulfill({ status: 500 }));
    await page.getByLabel("Workspace name").fill("Will Fail");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("We couldn't create that workspace. Try again.");
    await expectAccessible(page, "/workspaces create error");

    await page.route("**/api/auth/organization/set-active", (route) => route.fulfill({ status: 500 }));
    await page.getByLabel("Active workspace").selectOption({ label: "Studio Alpha" });
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't switch workspace" })).toBeVisible();
    await expectAccessible(page, "/workspaces switch error");

    await page.route("**/api/auth/sign-out", (route) => route.fulfill({ status: 500 }));
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "couldn't sign you out" })).toBeVisible();
    await expectAccessible(page, "/workspaces sign-out error");
  });
});

test.describe("keyboard only", () => {
  test("sign-up form", async ({ page }) => {
    await page.goto("/sign-up");
    await tabTo(page, page.getByLabel("Name", { exact: true }));
    await page.keyboard.type("Keyboard Owner");
    await tabTo(page, page.getByLabel("Email", { exact: true }));
    await page.keyboard.type(uniqueEmail());
    await tabTo(page, page.getByLabel("Password", { exact: true }));
    await page.keyboard.type(PASSWORD);
    await tabTo(page, page.getByRole("button", { name: "Create account" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in\?registered=1$/);
  });

  test("2FA enrolment form", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/workspaces$/);

    await tabTo(page, page.getByRole("link", { name: "Security" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/settings\/security$/);
    await tabTo(page, page.getByLabel("Current password"));
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press("Enter");

    await expectVisibleFocus(page.getByRole("heading", { name: "1. Add this account to your authenticator app" }));
    await tabTo(page, page.getByText("Show the full setup link"));
    await page.keyboard.press("Enter");
    const uri = page.getByTestId("totp-uri");
    await expect(uri).toBeVisible();
    const totp = totpFromUri((await uri.textContent())?.trim() ?? "");

    await tabTo(page, page.getByLabel("Authentication code"));
    await page.keyboard.type(totp.generate());
    await tabTo(page, page.getByRole("button", { name: "Verify and turn on" }));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");
  });

  test("workspace switch and sign out", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/workspaces$/);
    await createWorkspace(page, "Alpha Studio");
    await createWorkspace(page, "Beta Studio");

    await page.goto("/workspaces");
    const switcher = page.getByLabel("Active workspace");
    await tabTo(page, switcher);
    // Type-ahead on the closed select; arrow keys open the popup on macOS instead of changing the value.
    await page.keyboard.press("a");
    await expect(switcher.locator("option:checked")).toHaveText("Alpha Studio");
    await expect(page.getByRole("listitem").filter({ hasText: "Alpha Studio" })).toContainText("(active)");
    await expectVisibleFocus(switcher);

    await tabTo(page, page.getByRole("button", { name: "Sign out" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(await serverSession(page)).toBeNull();
  });
});
