import type { Page } from "@playwright/test";
import {
  CATALOG_ARCHIVE,
  CATALOG_ARCHIVED,
  CATALOG_CREATE,
  CATALOG_CREATE_NOT_KEPT,
  CATALOG_CREATED,
  CATALOG_CURRENCY_LOCKED,
  CATALOG_EDIT_NOT_KEPT,
  CATALOG_FORBIDDEN,
  CATALOG_INVALID,
  CATALOG_RESTORE,
  CATALOG_RESTORED,
  CATALOG_SAVE,
  CATALOG_SAVED,
} from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, openShellMenu, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Phase 2 plan Task 22: the catalog page (Admin and Owner), prices typed as text and stored exactly, the currency lock,
// archive and restore. Kept short: the image job runs every spec at three widths.
let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

// A new Owner of an onboarded MY workspace. Returns their email.
async function newOwner(page: Page): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Catalog Studio");
  return email;
}

const main = (page: Page) => page.getByRole("main");
// The edit form and the archive form each keep their own status line.
const status = (page: Page, text: string) => main(page).getByRole("status").filter({ hasText: text });
const row = (page: Page, name: string) => main(page).getByRole("row", { name: new RegExp(name) });
// The exact refusal for a third decimal in MYR (messages.ts priceErrorMessage): never rounded.
const TOO_MANY_DECIMALS = "A MYR price has at most 2 decimal places. We don't round prices, so enter it with at most 2.";

test("an Owner adds a service, edits its price, meets the currency lock, archives and restores it", async ({ page }) => {
  await newOwner(page);
  await openShellMenu(page);
  await page.getByRole("link", { name: "Catalog" }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole("heading", { level: 1, name: "Catalog" })).toBeVisible();
  // Prefilled from the workspace default currency; MYR and SGD head the list.
  await expect(page.getByLabel("Currency")).toHaveValue("MYR");
  await expect(page.getByLabel("Currency").locator("option").nth(1)).toHaveAttribute("value", "SGD");

  await page.getByLabel("Name").fill("Brand identity");
  await page.getByLabel("Default unit price").fill("1,234.505");
  await page.getByRole("button", { name: CATALOG_CREATE }).click();
  await expect(main(page).getByRole("alert")).toHaveText(CATALOG_INVALID);
  await expect(page.getByLabel("Default unit price")).toHaveAccessibleDescription(new RegExp(TOO_MANY_DECIMALS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // With JavaScript the refusal returns no typed text, yet the form keeps it, and focus is back on the button.
  await expect(page.getByLabel("Name")).toHaveValue("Brand identity");
  await expect(page.getByLabel("Default unit price")).toHaveValue("1,234.505");
  await expect(page.getByRole("button", { name: CATALOG_CREATE })).toBeFocused();
  await expectAccessible(page, "/catalog, price refused");

  await page.getByLabel("Default unit price").fill("1,234.50");
  await page.getByLabel("Unit", { exact: true }).fill("project");
  await page.getByRole("button", { name: CATALOG_CREATE }).click();
  await expect(status(page, CATALOG_CREATED)).toBeVisible();
  await expect(row(page, "Brand identity")).toContainText(/MYR\s1,234\.50/);
  await expectAccessible(page, "/catalog with a service");

  await row(page, "Brand identity").getByRole("link", { name: "Edit Brand identity" }).click();
  await expect(page).toHaveURL(/\/catalog\?edit=/);
  await expect(page.getByLabel("Default unit price")).toHaveValue("1234.50");
  await page.getByLabel("Currency").selectOption("SGD");
  await page.getByRole("button", { name: CATALOG_SAVE }).click();
  await expect(main(page).getByRole("alert")).toHaveText(CATALOG_CURRENCY_LOCKED);
  await expect(page.getByLabel("Currency")).toHaveValue("SGD");

  await page.getByLabel("Currency").selectOption("MYR");
  await page.getByLabel("Default unit price").fill("99.9");
  await page.getByRole("button", { name: CATALOG_SAVE }).click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  await expect(page.getByLabel("Default unit price")).toHaveValue("99.90");
  await expectAccessible(page, "/catalog, editing");

  await page.getByRole("button", { name: CATALOG_ARCHIVE }).click();
  await expect(status(page, CATALOG_ARCHIVED)).toBeVisible();
  await page.goto("/catalog");
  await expect(row(page, "Brand identity")).toHaveCount(0);
  await page.getByRole("link", { name: "Show archived services" }).click();
  await row(page, "Brand identity").getByRole("link", { name: "Edit Brand identity" }).click();
  await page.getByRole("button", { name: CATALOG_RESTORE }).click();
  await expect(status(page, CATALOG_RESTORED)).toBeVisible();
  await page.goto("/catalog");
  await expect(row(page, "Brand identity")).toContainText(/MYR\s99\.90/);
});

test("Staff get the refusal, not the catalog, and no Catalog link", async ({ page }) => {
  const email = await newOwner(page);
  await setMemberRole(email, "staff");
  await page.goto("/catalog");
  await expect(main(page).getByText(CATALOG_FORBIDDEN)).toBeVisible();
  await expect(page.getByLabel("Default unit price")).toHaveCount(0);
  await openShellMenu(page);
  await expect(page.getByRole("link", { name: "Catalog" })).toHaveCount(0);
});

// Charlie, 2026-11-26 ("2a"): a refusal returns none of the typed text, so without JavaScript the form shows the saved
// values again and says so; the price field still says why the price was refused.
test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a refused create or edit keeps no typed text, says so and why; the retyped post saves", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "the form is the same at every width; run once to keep the suite short");
    await newOwner(page);
    await page.goto("/catalog");
    await page.getByLabel("Name").fill("Aisha Rahman coaching");
    await page.getByLabel("Default unit price").fill("500.001");
    await page.getByRole("button", { name: CATALOG_CREATE }).click();
    await expect(main(page).getByRole("alert")).toHaveText(`${CATALOG_INVALID} ${CATALOG_CREATE_NOT_KEPT}`);
    await expect(main(page).getByText(TOO_MANY_DECIMALS)).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("");
    await expect(page.getByLabel("Default unit price")).toHaveValue("");
    expect(await page.content()).not.toContain("Aisha Rahman");
    expect(await page.content()).not.toContain("500.001");
    await expectAccessible(page, "/catalog, refused without JavaScript");

    await page.getByLabel("Name").fill("Workshop");
    await page.getByLabel("Default unit price").fill("500");
    await page.getByRole("button", { name: CATALOG_CREATE }).click();
    await expect(status(page, CATALOG_CREATED)).toBeVisible();
    await expect(row(page, "Workshop")).toContainText(/MYR\s500\.00/);

    await row(page, "Workshop").getByRole("link", { name: "Edit Workshop" }).click();
    await page.getByLabel("Name").fill("Aisha Rahman workshop");
    await page.getByLabel("Default unit price").fill("-5");
    await page.getByRole("button", { name: CATALOG_SAVE }).click();
    await expect(main(page).getByRole("alert")).toHaveText(`${CATALOG_INVALID} ${CATALOG_EDIT_NOT_KEPT}`);
    await expect(main(page).getByText("Enter a price of 0 or more.")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue("Workshop");
    await expect(page.getByLabel("Default unit price")).toHaveValue("500.00");
    expect(await page.content()).not.toContain("Aisha Rahman");

    await page.getByLabel("Currency").selectOption("SGD");
    await page.getByRole("button", { name: CATALOG_SAVE }).click();
    await expect(main(page).getByRole("alert")).toHaveText(`${CATALOG_CURRENCY_LOCKED} ${CATALOG_EDIT_NOT_KEPT}`);
    await expect(page.getByLabel("Currency")).toHaveValue("MYR");

    await page.getByLabel("Name").fill("Workshop day");
    await page.getByLabel("Default unit price").fill("450");
    await page.getByRole("button", { name: CATALOG_SAVE }).click();
    await expect(status(page, CATALOG_SAVED)).toBeVisible();
    await page.goto("/catalog");
    await expect(row(page, "Workshop day")).toContainText(/MYR\s450\.00/);
  });
});
