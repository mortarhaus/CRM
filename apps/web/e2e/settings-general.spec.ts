import type { Page } from "@playwright/test";
import {
  GENERAL_FORBIDDEN,
  GENERAL_SAVE,
  GENERAL_SAVED,
  GENERAL_SAVED_NEW_DOCUMENTS,
  NEW_DOCUMENTS_ONLY,
  ONBOARDING_INVALID,
  ONBOARDING_REGISTRATION_REQUIRED,
} from "../src/lib/auth/messages";
import { readWorkspaceSettings } from "../src/test/workspace-settings";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, openShellMenu, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Phase 2 plan Task 9: the general settings page (Admin and Owner, plan Q9). createWorkspace onboards the workspace as
// Malaysia, not SST-registered.

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
});

async function newOwner(page: Page, workspace: string): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, workspace);
  return email;
}

const save = (page: Page) => page.getByRole("button", { name: GENERAL_SAVE }).click();
const status = (page: Page) => page.getByRole("main").getByRole("status");

test("the Owner opens General from the navigation and saves the timezone and short code", async ({ page }) => {
  const email = await newOwner(page, "General Studio");
  await openShellMenu(page);
  await page.getByRole("link", { name: "General" }).click();
  await expect(page).toHaveURL(/\/settings\/general$/);
  await expect(page.getByRole("main")).toContainText("Malaysia");
  await expect(page.getByLabel("Timezone")).toHaveValue("Asia/Kuala_Lumpur");
  await expect(page.getByLabel("Base currency")).toHaveValue("MYR");
  await expect(page.getByLabel("Base currency")).toHaveAccessibleDescription(NEW_DOCUMENTS_ONLY);
  await expectAccessible(page, "/settings/general");

  await page.getByLabel("Short code").fill("gs1");
  await page.getByLabel("Timezone").selectOption("Asia/Singapore");
  await save(page);
  await expect(status(page)).toHaveText(GENERAL_SAVED);

  await page.reload();
  await expect(page.getByLabel("Short code")).toHaveValue("GS1");
  await expect(page.getByLabel("Timezone")).toHaveValue("Asia/Singapore");
  expect(await readWorkspaceSettings(email)).toMatchObject({ timezone: "Asia/Singapore", tax_registered: false });
});

test("an Admin turns SST on: a Yes needs the number, and the save says it applies to new documents only", async ({ page }) => {
  const email = await newOwner(page, "General Tax");
  await setMemberRole(email, "admin");
  await page.goto("/settings/general");

  await page.getByLabel("Yes", { exact: true }).check();
  await save(page);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(ONBOARDING_INVALID);
  const number = page.getByLabel("SST registration number");
  await expect(number).toHaveAttribute("aria-invalid", "true");
  await expect(number).toHaveAccessibleDescription(ONBOARDING_REGISTRATION_REQUIRED);
  await expectAccessible(page, "/settings/general, refused Yes");

  await number.fill("W10-1808-32000003");
  await save(page);
  await expect(status(page)).toHaveText(GENERAL_SAVED_NEW_DOCUMENTS);
  expect(await readWorkspaceSettings(email)).toMatchObject({
    tax_registered: true,
    tax_registration_no: "W10-1808-32000003",
    default_tax_name: "Service Tax",
    default_tax_rate_bps: 800,
  });
});

test("Staff get no General link and no form", async ({ page }) => {
  const email = await newOwner(page, "General Staff");
  await setMemberRole(email, "staff");
  await page.goto("/settings/general");
  await expect(page.getByRole("main")).toContainText(GENERAL_FORBIDDEN);
  await expect(page.getByRole("main").locator("form")).toHaveCount(0);
  await openShellMenu(page);
  await expect(page.getByRole("link", { name: "General" })).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a refused Yes comes back as a Yes with the refused field shown; the fixed post saves", async ({ page }) => {
    const email = await newOwner(page, "No Script General");
    await page.goto("/settings/general");
    await page.getByLabel("Yes", { exact: true }).check();
    await page.getByLabel("Tax rate (%)").fill("6");
    await save(page);

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(ONBOARDING_INVALID);
    await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
    const number = page.getByLabel("SST registration number");
    await expect(number).toBeVisible();
    await expect(number).toHaveAccessibleDescription(ONBOARDING_REGISTRATION_REQUIRED);
    await expect(page.getByLabel("Tax rate (%)")).toHaveValue("6");

    await number.fill("W10-1808-32000004");
    await save(page);
    await expect(status(page)).toHaveText(GENERAL_SAVED_NEW_DOCUMENTS);
    await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
    expect(await readWorkspaceSettings(email)).toMatchObject({ tax_registered: true, default_tax_rate_bps: 600 });
  });
});
