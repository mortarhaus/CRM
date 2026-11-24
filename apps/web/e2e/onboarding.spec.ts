import type { Page } from "@playwright/test";
import {
  GENERAL_SHORT_CODE_INVALID,
  NUMBERING_NO_CODE,
  ONBOARDING_INVALID,
  ONBOARDING_REGISTRATION_REQUIRED,
  ONBOARDING_SHORT_CODE_HINT,
  SETUP_PENDING,
} from "../src/lib/auth/messages";
import { readDocSequences, readWorkspaceSettings } from "../src/test/workspace-settings";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { completeOnboarding, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail, workspaceSwitcher } from "./helpers";

// Phase 2 plan Task 8, done-when "MY and SG defaults applied on sign-up" (spec line 1138), completed by PR 6 (plan
// Task 18): the invoice counter is seeded with the pattern (the same for MY and SG, plan Q10), reset yearly (Charlie
// 2026-11-23).
const INVOICE_SEQUENCE = [{ doc_type: "invoice", pattern: "INV-{CODE}-{YYYY}-{SEQ:4}", reset_rule: "yearly", counter: 0 }];

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

test("MY, not SST-registered, short code skipped: MYR, Asia/Kuala_Lumpur and dd-mmm-yyyy are applied, tax stays off", async ({
  page,
}) => {
  const email = await newOwnerAtOnboarding(page, "MY Studio");
  await expect(page.getByRole("heading", { level: 1, name: "Set up your workspace" })).toBeVisible();
  await expectAccessible(page, "/onboarding country step");

  await page.getByLabel("Malaysia", { exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("group", { name: "Are you registered for SST?" })).toBeVisible();
  await expect(page.getByLabel("No", { exact: true })).toBeChecked();
  // The tax fields show only for a Yes.
  await expect(page.getByLabel("SST registration number")).toBeHidden();
  // Charlie 2026-11-24: the short code is asked, never pre-filled, and can be skipped.
  await expect(page.getByLabel("Short code")).toHaveValue("");
  await expect(page.getByLabel("Short code")).toHaveAccessibleDescription(ONBOARDING_SHORT_CODE_HINT);
  await expectAccessible(page, "/onboarding SST question");

  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  expect(await readWorkspaceSettings(email)).toEqual({
    country: "MY",
    base_currency: "MYR",
    default_currency: "MYR",
    timezone: "Asia/Kuala_Lumpur",
    date_format: "dd-mmm-yyyy",
    locale: "en",
    tax_registered: false,
    tax_registration_no: null,
    default_tax_name: null,
    default_tax_rate_bps: null,
    short_code: null,
  });
  expect(await readDocSequences(email)).toEqual(INVOICE_SEQUENCE);

  // Skipped, the numbering page says to set the code in General settings, and links there.
  await page.goto("/settings/numbering");
  await expect(page.locator("#number-preview")).toContainText(NUMBERING_NO_CODE);
  await page.getByRole("link", { name: "General settings" }).click();
  await expect(page).toHaveURL(/\/settings\/general$/);
  await expect(page.getByLabel("Short code")).toHaveValue("");
});

test("SG, GST-registered: a Yes without a number and a bad short code are refused; GST 9% preselected; the code is saved", async ({
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
  const code = page.getByLabel("Short code");
  await code.fill("S");

  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  // A11Y-01: the button was disabled while the post was in flight, so focus goes back to it after the refusal.
  await expect(page.getByRole("button", { name: "Finish setup" })).toBeFocused();
  await expect(number).toHaveAttribute("aria-invalid", "true");
  await expect(number).toHaveAccessibleDescription(ONBOARDING_REGISTRATION_REQUIRED);
  await expect(code).toHaveAttribute("aria-invalid", "true");
  await expect(code).toHaveAccessibleDescription(`${ONBOARDING_SHORT_CODE_HINT} ${GENERAL_SHORT_CODE_INVALID}`);
  await expect(code).toHaveValue("S");
  await expectAccessible(page, "/onboarding refused Yes");
  expect((await readWorkspaceSettings(email)).country).toBeNull();
  expect(await readDocSequences(email)).toEqual([]);

  await number.fill("M90312345A");
  await code.fill("sg1");
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  expect(await readWorkspaceSettings(email)).toEqual({
    country: "SG",
    base_currency: "SGD",
    default_currency: "SGD",
    timezone: "Asia/Singapore",
    date_format: "dd-mmm-yyyy",
    locale: "en",
    tax_registered: true,
    tax_registration_no: "M90312345A",
    default_tax_name: "GST",
    default_tax_rate_bps: 900,
    short_code: "SG1",
  });
  expect(await readDocSequences(email)).toEqual(INVOICE_SEQUENCE);
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
  for (const name of ["General", "Branding", "Numbering"]) await expect(page.getByRole("link", { name })).toHaveCount(0);
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

  // PR #56 R1: a refused Yes comes back as a Yes, with the refused field shown and its error, and the tax name and rate
  // as typed. The registration number is not sent back (it is personal data for a sole trader); here it was empty.
  test("a refused Yes comes back with Yes selected, the refused field shown, and the typed tax name and rate", async ({ page }) => {
    const email = await newOwnerAtOnboarding(page, "No Script Refused");
    await page.getByLabel("Malaysia", { exact: true }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Yes", { exact: true }).check();
    await page.getByLabel("Tax name").fill("Sales and Service Tax");
    await page.getByLabel("Tax rate (%)").fill("6");
    await page.getByLabel("Short code").fill("ns1");
    await page.getByRole("button", { name: "Finish setup" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText(ONBOARDING_INVALID);
    await expect(page.getByLabel("Yes", { exact: true })).toBeChecked();
    const number = page.getByLabel("SST registration number");
    await expect(number).toBeVisible();
    await expect(number).toHaveAttribute("aria-invalid", "true");
    await expect(number).toHaveAccessibleDescription(ONBOARDING_REGISTRATION_REQUIRED);
    await expect(page.getByLabel("Tax name")).toHaveValue("Sales and Service Tax");
    await expect(page.getByLabel("Tax rate (%)")).toHaveValue("6");
    await expect(page.getByLabel("Short code")).toHaveValue("ns1");

    await number.fill("W10-1808-32000002");
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    expect(await readWorkspaceSettings(email)).toMatchObject({
      tax_registered: true,
      tax_registration_no: "W10-1808-32000002",
      default_tax_name: "Sales and Service Tax",
      default_tax_rate_bps: 600,
      short_code: "NS1",
    });
  });
});
