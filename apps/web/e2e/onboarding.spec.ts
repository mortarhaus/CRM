import type { Page } from "@playwright/test";
import { ONBOARDING_REGISTRATION_REQUIRED, SETUP_PENDING } from "../src/lib/auth/messages";
import { readWorkspaceSettings } from "../src/test/workspace-settings";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { completeOnboarding, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail, workspaceSwitcher } from "./helpers";

// Phase 2 plan Task 8, done-when "MY and SG defaults applied on sign-up" (spec line 1138) as far as the spec gives the
// values: the MY invoice pattern is seeded with doc_sequence (plan PR 6, re-run there), and the SG invoice pattern, the
// SG date format and both locales are unanswered (plan Q10), so they must stay empty.

// A new user who creates a workspace and is sent to its onboarding. Returns their email.
async function newOwnerAtOnboarding(page: Page, workspace: string): Promise<string> {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByLabel("Workspace name").fill(workspace);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  return email;
}

test("MY, not SST-registered: MYR, Asia/Kuala_Lumpur and dd/mm/yyyy are applied, and tax stays off", async ({ page }) => {
  const email = await newOwnerAtOnboarding(page, "MY Studio");
  await expect(page.getByRole("heading", { level: 1, name: "Set up your workspace" })).toBeVisible();
  await expectAccessible(page, "/onboarding country step");

  await page.getByLabel("Malaysia", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("group", { name: "Are you registered for SST?" })).toBeVisible();
  await expect(page.getByLabel("No", { exact: true })).toBeChecked();
  // The tax fields show only for a Yes.
  await expect(page.getByLabel("SST registration number")).toBeHidden();
  await expectAccessible(page, "/onboarding SST question");

  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  expect(await readWorkspaceSettings(email)).toEqual({
    country: "MY",
    base_currency: "MYR",
    default_currency: "MYR",
    timezone: "Asia/Kuala_Lumpur",
    date_format: "dd/mm/yyyy",
    locale: null,
    tax_registered: false,
    tax_registration_no: null,
    default_tax_name: null,
    default_tax_rate_bps: null,
  });
});

test("SG, GST-registered: a Yes without a number is refused; GST 9% is preselected and SGD, Asia/Singapore applied", async ({
  page,
}) => {
  const email = await newOwnerAtOnboarding(page, "SG Studio");
  await page.getByLabel("Singapore", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Yes", { exact: true }).check();
  const number = page.getByLabel("GST registration number");
  await expect(number).toBeVisible();
  await expect(page.getByLabel("Tax name")).toHaveValue("GST");
  await expect(page.getByLabel("Tax rate (%)")).toHaveValue("9");

  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(number).toHaveAttribute("aria-invalid", "true");
  await expect(number).toHaveAccessibleDescription(ONBOARDING_REGISTRATION_REQUIRED);
  await expectAccessible(page, "/onboarding refused Yes");
  expect((await readWorkspaceSettings(email)).country).toBeNull();

  await number.fill("M90312345A");
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  expect(await readWorkspaceSettings(email)).toEqual({
    country: "SG",
    base_currency: "SGD",
    default_currency: "SGD",
    timezone: "Asia/Singapore",
    date_format: null,
    locale: null,
    tax_registered: true,
    tax_registration_no: "M90312345A",
    default_tax_name: "GST",
    default_tax_rate_bps: 900,
  });
});

test("an Owner who leaves onboarding unfinished is sent back to it, and its link back to the country works", async ({ page }) => {
  await newOwnerAtOnboarding(page, "Unfinished Studio");
  await page.goto("/settings/branding");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Malaysia", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("link", { name: "Change country" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await completeOnboarding(page, "Singapore");
});

test("Staff of a workspace not yet set up see only that the owner has not finished, with the switcher", async ({ page }) => {
  const email = await newOwnerAtOnboarding(page, "Pending Studio");
  await setMemberRole(email, "staff");
  await page.goto("/workspaces");
  await expect(page.getByRole("heading", { level: 1, name: SETUP_PENDING })).toBeVisible();
  await expect(workspaceSwitcher(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Branding" })).toHaveCount(0);
  await expectAccessible(page, "setup pending");

  // The onboarding page is the Owner's only.
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1, name: SETUP_PENDING })).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("MY, SST-registered: both steps post as plain forms, and Service Tax 8% is stored", async ({ page }) => {
    const email = await newOwnerAtOnboarding(page, "No Script Tax");
    await page.getByLabel("Malaysia", { exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Yes", { exact: true }).check();
    await page.getByLabel("SST registration number").fill("W10-1808-32000001");
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    expect(await readWorkspaceSettings(email)).toMatchObject({
      country: "MY",
      tax_registered: true,
      tax_registration_no: "W10-1808-32000001",
      default_tax_name: "Service Tax",
      default_tax_rate_bps: 800,
    });
  });
});
