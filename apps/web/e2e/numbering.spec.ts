import type { Page } from "@playwright/test";
import {
  NUMBERING_FORBIDDEN,
  NUMBERING_INVALID,
  NUMBERING_NO_CODE,
  NUMBERING_SAVED,
  NUMBERING_SAVE,
} from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, openShellMenu, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Phase 2 plan Task 19: the numbering page, its live preview (the core formatter in the browser) and the role check.
let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

// A new Owner of an onboarded MY workspace (no short code yet). Returns their email.
async function newOwner(page: Page): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Numbering Studio");
  return email;
}

// Today's year and month in Kuala Lumpur, the MY workspace time zone.
function klYearMonth(): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit" }).formatToParts(
    new Date(),
  );
  return { year: parts.find((p) => p.type === "year")?.value ?? "", month: parts.find((p) => p.type === "month")?.value ?? "" };
}

const patternField = (page: Page) => page.getByLabel("Invoice number pattern");
const preview = (page: Page) => page.locator("#number-preview");

test("the preview follows the pattern as it is typed; an unknown token is refused; a save is kept", async ({ page }) => {
  await newOwner(page);
  await openShellMenu(page);
  await page.getByRole("link", { name: "Numbering" }).click();
  await expect(page).toHaveURL(/\/settings\/numbering$/);
  await expect(page.getByRole("heading", { level: 1, name: "Document numbering" })).toBeVisible();

  // The seeded MY default (onboarding), yearly; {CODE} has no short code yet.
  await expect(patternField(page)).toHaveValue("INV-{CODE}-{YYYY}-{SEQ:4}");
  await expect(page.getByLabel("Start the counter again at 1")).toHaveValue("yearly");
  await expect(preview(page)).toHaveAttribute("aria-live", "polite");
  await expect(preview(page)).toContainText(NUMBERING_NO_CODE);
  await expect(page.getByText("A change applies to new documents only.")).toBeVisible();
  await expectAccessible(page, "/settings/numbering");

  const { year, month } = klYearMonth();
  await patternField(page).fill("INV-{YYYY}-{SEQ:4}");
  await expect(preview(page)).toHaveText(`INV-${year}-0001`);

  await patternField(page).fill("INV-{DD}-{SEQ:4}");
  await expect(preview(page)).toContainText("{DD} is not a token");
  await expect(patternField(page)).toHaveAttribute("aria-invalid", "true");
  await expectAccessible(page, "/settings/numbering, unknown token");
  await page.getByRole("button", { name: NUMBERING_SAVE }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(NUMBERING_INVALID);
  // The refusal is tied to the field as well as announced (Bob PR #72 R1 P3).
  await expect(patternField(page)).toHaveAccessibleDescription(new RegExp(NUMBERING_INVALID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  // A monthly counter needs the month: the preview says so until {MM} is in the pattern.
  await page.getByLabel("Start the counter again at 1").selectOption("monthly");
  await patternField(page).fill("Q{YY}{SEQ:3}");
  await expect(preview(page)).toContainText("needs the year and {MM}");
  await patternField(page).fill("Q{YY}{MM}-{SEQ:3}");
  await expect(preview(page)).toHaveText(`Q${year.slice(-2)}${month}-001`);
  await page.getByRole("button", { name: NUMBERING_SAVE }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(NUMBERING_SAVED);
  // A11Y-01: focus goes back to the button after the save.
  await expect(page.getByRole("button", { name: NUMBERING_SAVE })).toBeFocused();

  await page.reload();
  await expect(patternField(page)).toHaveValue("Q{YY}{MM}-{SEQ:3}");
  await expect(page.getByLabel("Start the counter again at 1")).toHaveValue("monthly");
});

test("Staff get the refusal, not the form, and no Numbering link", async ({ page }) => {
  const email = await newOwner(page);
  await setMemberRole(email, "staff");
  await page.goto("/settings/numbering");
  await expect(page.getByRole("main").getByText(NUMBERING_FORBIDDEN)).toBeVisible();
  await expect(patternField(page)).toHaveCount(0);
  await openShellMenu(page);
  await expect(page.getByRole("link", { name: "Numbering" })).toHaveCount(0);
  await expectAccessible(page, "/settings/numbering as Staff");
});
