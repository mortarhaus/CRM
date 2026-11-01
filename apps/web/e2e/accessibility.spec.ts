import { randomUUID } from "node:crypto";
import { WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { SEND_TEST_EMAIL, TEST_EMAIL_FAILED, TEST_EMAIL_FORBIDDEN, TEST_EMAIL_QUEUED } from "../src/lib/auth/messages";
import { totpFromUri, wrongTotpCode } from "../src/test/totp";
import { expectAccessible, expectVisibleFocus, tabTo } from "./a11y";
import {
  failServerActions,
  PASSWORD,
  respectRateLimit,
  setMemberRole,
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

// A new Owner of one workspace, on /settings/email.
async function openEmailSettingsAsOwner(page: Page): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Mail Studio");
  await page.goto("/settings/email");
  await expect(page.getByRole("button", { name: SEND_TEST_EMAIL })).toBeVisible();
  return email;
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

    await page.getByLabel("Name", { exact: true }).fill("Error Case");
    // The browser accepts an address without a dot in the domain; the server refuses it.
    await page.getByLabel("Email", { exact: true }).fill("error-case@localhost");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "We couldn't create your account. Check your details and try again.",
    );
    await expectAccessible(page, "/sign-up server refusal");

    // The form's server action cannot be reached: the error page offers a retry.
    await page.route("**/sign-up", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "We couldn't finish that request. Check your connection and try again.",
    );
    await expectAccessible(page, "/sign-up unreachable server");
    await page.unroute("**/sign-up");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

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

    await page.getByLabel("Workspace name").fill("   ");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter a workspace name.");
    await expectAccessible(page, "/workspaces create error");

    // Better Auth refuses a workspace the user is not a member of.
    const switcher = page.getByLabel("Active workspace");
    await switcher.locator("option", { hasText: "Studio Alpha" }).evaluate((option: HTMLOptionElement, id) => {
      option.value = id;
    }, randomUUID());
    await switcher.focus();
    await switcher.selectOption({ label: "Studio Alpha" });
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't switch workspace" })).toBeVisible();
    // Better Auth clears the active workspace when it refuses one; the select follows the server.
    await expect(switcher.locator("option:checked")).toHaveText("Choose a workspace");
    await expect(switcher).toBeFocused();
    await expectAccessible(page, "/workspaces switch refused");

    const restore = await failServerActions(page, "server");
    await page.getByRole("button", { name: "Switch" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't switch workspace" })).toBeVisible();
    await expectAccessible(page, "/workspaces switch unreachable");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "couldn't sign you out" })).toBeVisible();
    await expectAccessible(page, "/workspaces sign-out error");
    await restore();
  });

  test("email settings page in its initial, queued, failed and Staff states", async ({ page }) => {
    const email = await openEmailSettingsAsOwner(page);
    await expectAccessible(page, "/settings/email initial");

    const button = page.getByRole("button", { name: SEND_TEST_EMAIL });
    await button.click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(TEST_EMAIL_QUEUED);
    await expectAccessible(page, "/settings/email queued");

    // The longest message on the page (FE-71).
    const restore = await failServerActions(page, "server");
    await button.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(TEST_EMAIL_FAILED);
    await expectAccessible(page, "/settings/email failed");
    await restore();

    await setMemberRole(email, "staff");
    await page.reload();
    await expect(page.getByRole("main")).toContainText(TEST_EMAIL_FORBIDDEN);
    await expectAccessible(page, "/settings/email Staff");
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

  test("test email", async ({ page }) => {
    await openEmailSettingsAsOwner(page);
    const button = page.getByRole("button", { name: SEND_TEST_EMAIL });
    await tabTo(page, button);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main").getByRole("status")).toHaveText(TEST_EMAIL_QUEUED);
    // The button was disabled while the post was in flight; focus is back on it.
    await expectVisibleFocus(button);
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

    // The Switch button (the path without JavaScript) is next in the tab order and shows focus.
    await tabTo(page, page.getByRole("button", { name: "Switch" }));

    await tabTo(page, page.getByRole("button", { name: "Sign out" }));
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(await serverSession(page)).toBeNull();
  });
});
