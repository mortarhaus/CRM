import type { Page } from "@playwright/test";
import {
  CATALOG_ARCHIVE,
  CATALOG_ARCHIVED,
  CATALOG_CREATE,
  CATALOG_CREATE_NOT_KEPT,
  CATALOG_CREATED,
  CATALOG_CURRENCY_LOCKED,
  CATALOG_EDIT_NOT_KEPT,
  CATALOG_FAILED,
  CATALOG_FORBIDDEN,
  CATALOG_INVALID,
  CATALOG_RESTORE,
  CATALOG_RESTORED,
  CATALOG_SAVE,
  CATALOG_SAVED,
  CATALOG_STALE,
  WORKSPACE_CHANGED_MESSAGE,
} from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, failServerActions, openShellMenu, respectRateLimit, setMemberRole, signIn, signUp, switchTo, uniqueEmail } from "./helpers";

// Phase 2 plan Task 22: the catalog page (Admin and Owner), prices typed as text and stored exactly, the currency lock,
// archive and restore. Kept short: CI runs every spec at three widths.
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
  await page.getByLabel("Currency").selectOption("SGD");
  await page.getByRole("button", { name: CATALOG_CREATE }).click();
  await expect(main(page).getByRole("alert")).toHaveText(CATALOG_INVALID);
  // The reason is given in the currency the price was posted in.
  await expect(page.getByLabel("Default unit price")).toHaveAccessibleDescription(new RegExp(TOO_MANY_DECIMALS.replace("MYR", "SGD").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // With JavaScript the refusal returns no typed text, yet the form keeps it, and focus is back on the button.
  await expect(page.getByLabel("Name")).toHaveValue("Brand identity");
  await expect(page.getByLabel("Default unit price")).toHaveValue("1,234.505");
  await expect(page.getByLabel("Currency")).toHaveValue("SGD");
  await expect(page.getByRole("button", { name: CATALOG_CREATE })).toBeFocused();
  await expectAccessible(page, "/catalog, price refused");

  await page.getByLabel("Default unit price").fill("1,234.50");
  await page.getByLabel("Currency").selectOption("MYR");
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

type Draft = { name: string; description: string; price: string; currency: string; unit: string; taxable: boolean };

async function fillDraft(page: Page, draft: Draft): Promise<void> {
  await page.getByLabel("Name").fill(draft.name);
  await page.getByLabel("Default description").fill(draft.description);
  await page.getByLabel("Default unit price").fill(draft.price);
  await page.getByLabel("Currency").selectOption(draft.currency);
  await page.getByLabel("Unit", { exact: true }).fill(draft.unit);
  await page.getByLabel("Taxable by default").setChecked(draft.taxable);
}

async function expectDraft(page: Page, draft: Draft): Promise<void> {
  await expect(page.getByLabel("Name")).toHaveValue(draft.name);
  await expect(page.getByLabel("Default description")).toHaveValue(draft.description);
  await expect(page.getByLabel("Default unit price")).toHaveValue(draft.price);
  await expect(page.getByLabel("Currency")).toHaveValue(draft.currency);
  await expect(page.getByLabel("Unit", { exact: true })).toHaveValue(draft.unit);
  if (draft.taxable) await expect(page.getByLabel("Taxable by default")).toBeChecked();
  else await expect(page.getByLabel("Taxable by default")).not.toBeChecked();
}

const EMPTY: Draft = { name: "", description: "", price: "", currency: "MYR", unit: "", taxable: false };

// PR #78 Review R1 P1: with JavaScript, a refusal after a save keeps every field as typed (the action returns none of
// it), whatever came before; only a save starts the form again (create) or shows the stored row (edit).
test("with JavaScript a draft survives every refusal after a save, and the corrected retry saves", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "the form is the same at every width; run once to keep the suite short");
  await newOwner(page);
  await createWorkspace(page, "Catalog Elsewhere");
  await switchTo(page, "Catalog Studio");
  await page.goto("/catalog");
  const alert = main(page).getByRole("alert");
  const save = page.getByRole("button", { name: CATALOG_SAVE });
  const create = page.getByRole("button", { name: CATALOG_CREATE });

  // Create: a save, then a refused draft (twice), then the corrected retry, then a second save in a row.
  await fillDraft(page, { name: "Discovery", description: "One call.", price: "100", currency: "MYR", unit: "call", taxable: true });
  await create.click();
  await expect(status(page, CATALOG_CREATED)).toBeVisible();
  await expectDraft(page, EMPTY);
  const retainer: Draft = { name: "Aisha Rahman retainer", description: "Monthly.\nTwo calls.", price: "10.001", currency: "SGD", unit: "month", taxable: true };
  await fillDraft(page, retainer);
  await create.click();
  await expect(alert).toHaveText(CATALOG_INVALID);
  await expectDraft(page, retainer);
  await create.click();
  await expect(alert).toHaveText(CATALOG_INVALID);
  await expectDraft(page, retainer);
  await page.getByLabel("Default unit price").fill("10.00");
  await create.click();
  await expect(status(page, CATALOG_CREATED)).toBeVisible();
  await expectDraft(page, EMPTY);
  await fillDraft(page, { ...EMPTY, name: "Workshop", price: "500" });
  await create.click();
  await expect(row(page, "Workshop")).toContainText(/MYR\s500\.00/);
  await expectDraft(page, EMPTY);
  await expect(row(page, "Aisha Rahman retainer")).toContainText(/SGD\s10\.00/);

  // Edit: a save shows the stored row; a refused draft (twice), an unreachable server, a stale version, the currency
  // lock and a workspace switch each keep it; the corrected retry and two saves in a row save.
  await row(page, "Aisha Rahman retainer").getByRole("link", { name: "Edit Aisha Rahman retainer" }).click();
  await expectDraft(page, { ...retainer, price: "10.00" });
  await fillDraft(page, { ...retainer, name: "Retainer", price: "20" });
  await save.click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  await expectDraft(page, { ...retainer, name: "Retainer", price: "20.00" });
  const edited: Draft = { name: "Retainer plus", description: "Weekly.", price: "-1", currency: "SGD", unit: "week", taxable: false };
  await fillDraft(page, edited);
  await save.click();
  await expect(alert).toHaveText(CATALOG_INVALID);
  await expectDraft(page, edited);
  await save.click();
  await expect(alert).toHaveText(CATALOG_INVALID);
  await expectDraft(page, edited);

  const restore = await failServerActions(page, "network");
  await save.click();
  await expect(alert).toHaveText(CATALOG_FAILED);
  await expectDraft(page, edited);
  await restore();

  await page.getByLabel("Default unit price").fill("30");
  await save.click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  const stored: Draft = { ...edited, price: "30.00" };
  await expectDraft(page, stored);
  await fillDraft(page, { ...stored, name: "Retainer two" });
  // The refresh after this save must land before the other tab saves, or this page would load the newer version.
  const refreshed = page.waitForResponse((r) => r.request().method() === "GET" && r.url().includes("edit=") && r.request().headers().rsc === "1");
  await save.click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  await refreshed;
  await expectDraft(page, { ...stored, name: "Retainer two" });

  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByLabel("Name").fill("Changed elsewhere");
  await other.getByRole("button", { name: CATALOG_SAVE }).click();
  await expect(other.getByRole("main").getByRole("status").filter({ hasText: CATALOG_SAVED })).toBeVisible();
  const late: Draft = { ...stored, name: "Retainer late", description: "Late.", unit: "visit", taxable: true };
  await fillDraft(page, late);
  await save.click();
  await expect(alert).toHaveText(CATALOG_STALE);
  await expectDraft(page, late);

  await page.reload();
  await expectDraft(page, { ...stored, name: "Changed elsewhere" });
  await fillDraft(page, { ...late, currency: "MYR" });
  await save.click();
  await expect(alert).toHaveText(CATALOG_CURRENCY_LOCKED);
  // The currency goes back to the stored one (Charlie, 2026-11-26, "B"); the rest stays as typed.
  await expectDraft(page, late);

  await switchTo(other, "Catalog Elsewhere");
  await save.click();
  await expect(alert).toHaveText(WORKSPACE_CHANGED_MESSAGE);
  await expectDraft(page, late);
  await switchTo(other, "Catalog Studio");
  await other.close();
  await save.click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  await page.goto("/catalog");
  await expect(row(page, "Retainer late")).toContainText(/SGD\s30\.00/);
});

// Charlie, 2026-11-26 ("B"): with JavaScript, every currency-lock refusal puts the currency select back to the stored
// currency and keeps the other fields as typed, whatever came before it; the next save then posts the stored currency.
test("with JavaScript a currency-lock refusal puts the stored currency back and keeps the rest", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "the form is the same at every width; run once to keep the suite short");
  await newOwner(page);
  await page.goto("/catalog");
  const alert = main(page).getByRole("alert");
  const save = page.getByRole("button", { name: CATALOG_SAVE });
  await fillDraft(page, { ...EMPTY, name: "Lock audit", price: "100" });
  await page.getByRole("button", { name: CATALOG_CREATE }).click();
  await expect(status(page, CATALOG_CREATED)).toBeVisible();
  await row(page, "Lock audit").getByRole("link", { name: "Edit Lock audit" }).click();
  await expectDraft(page, { ...EMPTY, name: "Lock audit", price: "100.00" });

  const refusedLock = async (draft: Draft) => {
    await fillDraft(page, { ...draft, currency: "SGD" });
    await save.click();
    await expect(alert).toHaveText(CATALOG_CURRENCY_LOCKED);
    await expectDraft(page, { ...draft, currency: "MYR" });
  };
  const typed: Draft = { name: "Lock one", description: "Kept.", price: "100.00", currency: "MYR", unit: "audit", taxable: true };
  // Straight after the Edit link (from a created service), then again in a row.
  await refusedLock(typed);
  await refusedLock({ ...typed, name: "Lock again" });
  // After another refusal.
  await page.getByLabel("Default unit price").fill("-1");
  await save.click();
  await expect(alert).toHaveText(CATALOG_INVALID);
  await refusedLock({ ...typed, name: "Lock after invalid", price: "100" });
  // After a save.
  await save.click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  await expectDraft(page, { ...typed, name: "Lock after invalid", price: "100.00" });
  await refusedLock({ ...typed, name: "Lock after save", price: "100.00" });
  // After a page load; the next save posts the stored currency.
  await page.reload();
  await refusedLock({ ...typed, name: "Lock after load" });
  await save.click();
  await expect(status(page, CATALOG_SAVED)).toBeVisible();
  await page.goto("/catalog");
  await expect(row(page, "Lock after load")).toContainText(/MYR\s100\.00/);
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
