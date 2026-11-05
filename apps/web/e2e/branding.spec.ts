import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import {
  BRANDING_FORBIDDEN,
  BRANDING_INVALID,
  BRANDING_SAVED,
  BRANDING_STALE,
  SAVE_BRANDING,
} from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { openShellMenu, recordCspViolations, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Plan Task 6: the branding page, the drag picker, both derived variants, and the nonce'd brand token.
// #ffe066 is pale: the light theme renders it darkened to #ad8a00 (3.05:1 on the page), the dark theme as it is.
const PALE = "#ffe066";
const PALE_ON_LIGHT = "rgb(173, 138, 0)";
const PALE_ON_DARK = "rgb(255, 224, 102)";

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

// A new user who creates a workspace (so is its Owner) and opens Branding from the navigation.
async function openAsOwner(page: Page): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.getByLabel("Workspace name").fill("Brand Studio");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText("Brand Studio");
  await openShellMenu(page);
  await page.getByRole("link", { name: "Branding" }).click();
  await expect(page).toHaveURL(/\/settings\/branding$/);
  await expect(page.getByRole("heading", { level: 1, name: "Branding" })).toBeVisible();
  return email;
}

const hexField = (page: Page) => page.getByLabel("Brand colour", { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: SAVE_BRANDING });
const preview = (page: Page, theme: "Light theme" | "Dark theme") => page.getByRole("figure", { name: theme });

async function save(page: Page, hex: string): Promise<void> {
  await hexField(page).fill(hex);
  await saveButton(page).click();
}

async function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

// The figure's description, read through its aria-describedby.
async function description(figure: Locator): Promise<string> {
  const id = await figure.getAttribute("aria-describedby");
  expect(id, "the preview has no aria-describedby").toBeTruthy();
  return (await figure.page().locator(`[id="${id}"]`).textContent()) ?? "";
}

test("a saved colour applies as the accent in both themes after a reload, with no CSP violation", async ({ page }) => {
  const violations = await recordCspViolations(page);
  await openAsOwner(page);
  await save(page, " #FFE066 ");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(BRANDING_SAVED);

  const response = await page.reload();
  const nonce = /'nonce-([^']+)'/.exec(response?.headers()["content-security-policy"] ?? "")?.[1];
  // The token is a <style> with this request's nonce, built from the stored value only.
  expect(await response?.text()).toContain(
    `<style nonce="${nonce}">:root{--accent:light-dark(#ad8a00,#ffe066);--accent-foreground:light-dark(#000000,#000000)}</style>`,
  );
  await expect(hexField(page)).toHaveValue(PALE);
  for (const [colorScheme, expected] of [
    ["light", PALE_ON_LIGHT],
    ["dark", PALE_ON_DARK],
  ] as const) {
    await page.emulateMedia({ colorScheme });
    // The Save button is a primary fill; its text is black on both variants.
    await expect.poll(() => background(saveButton(page)), colorScheme).toBe(expected);
    await expect(saveButton(page)).toHaveCSS("color", "rgb(0, 0, 0)");
  }
  expect(violations).toEqual([]);
});

test("the preview shows both rendered variants, each described through aria-describedby", async ({ page }) => {
  await openAsOwner(page);
  // The default accent passes on both themes, so neither variant is moved. Ratios are rounded down (5.589, 6.006; 3.268, 3.138).
  expect(await description(preview(page, "Light theme"))).toBe(
    "Light theme: filled with #0e6c84, with white text. Contrast 5.58:1 against the page and 6.00:1 against cards.",
  );
  expect(await description(preview(page, "Dark theme"))).toBe(
    "Dark theme: filled with #0e6c84, with white text. Contrast 3.26:1 against the page and 3.13:1 against cards.",
  );

  // Typing a colour previews it before it is saved; both panels show their own theme whatever the page's theme is.
  await hexField(page).fill(PALE);
  expect(await description(preview(page, "Light theme"))).toContain("filled with #ad8a00 (darkened from #ffe066 for contrast)");
  expect(await description(preview(page, "Dark theme"))).toContain("filled with #ffe066, with black text");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect.poll(() => background(preview(page, "Light theme").getByText("Button", { exact: true })), colorScheme).toBe(PALE_ON_LIGHT);
    await expect.poll(() => background(preview(page, "Dark theme").getByText("Button", { exact: true })), colorScheme).toBe(PALE_ON_DARK);
  }
  await page.emulateMedia({ colorScheme: null });
  await expectAccessible(page, "/settings/branding, pale colour previewed");
});

test("the drag picker works from the keyboard and fills the hex field", async ({ page }) => {
  await openAsOwner(page);
  const hue = page.getByRole("slider", { name: "Hue" });
  const area = page.getByRole("slider", { name: "Saturation and brightness" });
  // #0e6c84: hue 192, saturation 89, brightness 52.
  await expect(hue).toHaveAttribute("aria-valuetext", "Hue 192 degrees");
  await expect(area).toHaveAttribute("aria-valuetext", "Saturation 89%, brightness 52%");

  await hue.focus();
  await page.keyboard.press("Home");
  await expect(hue).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(hue).toHaveAttribute("aria-valuetext", "Hue 11 degrees");

  await area.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("ArrowUp");
  await expect(area).toHaveAttribute("aria-valuetext", "Saturation 100%, brightness 63%");
  // Hue 11, saturation 100, brightness 63.
  await expect(hexField(page)).toHaveValue("#a11d00");

  await saveButton(page).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(BRANDING_SAVED);
  await page.reload();
  await expect(hexField(page)).toHaveValue("#a11d00");
});

test("an invalid colour and a stale version are refused with a clear message", async ({ page, context }) => {
  await openAsOwner(page);
  await save(page, "#fff");
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toHaveText(BRANDING_INVALID);
  await expect(hexField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(hexField(page)).toHaveAttribute("aria-describedby", "brand-colour-hint branding-error");
  await expectAccessible(page, "/settings/branding, invalid colour");

  // A second tab saves first; this page still holds the version it was rendered with.
  const other = await context.newPage();
  await other.goto("/settings/branding");
  await save(other, "#123456");
  await expect(other.getByRole("main").getByRole("status")).toHaveText(BRANDING_SAVED);
  await other.close();

  await save(page, PALE);
  await expect(alert).toHaveText(BRANDING_STALE);
  await expectAccessible(page, "/settings/branding, stale version");
  await page.reload();
  await expect(hexField(page)).toHaveValue("#123456");
});

test("Staff get no Branding link, no form, and FORBIDDEN from a post of the page they had open (AUTH-02)", async ({
  page,
}) => {
  const email = await openAsOwner(page);
  await setMemberRole(email, "staff");

  await save(page, PALE);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(BRANDING_FORBIDDEN);

  await page.reload();
  await expect(page.getByRole("main")).toContainText(BRANDING_FORBIDDEN);
  await expect(page.getByRole("main").locator("form")).toHaveCount(0);
  await openShellMenu(page);
  await expect(page.getByRole("link", { name: "Branding" })).toHaveCount(0);
  await expectAccessible(page, "/settings/branding Staff");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the hex field saves through a plain form post, and the drag picker is not rendered", async ({ page }) => {
    const email = uniqueEmail();
    await signUp(page, email);
    await signIn(page, email);
    await page.getByLabel("Workspace name").fill("No Script Brand");
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.goto("/settings/branding");
    await expect(page.getByRole("slider")).toHaveCount(0);

    await save(page, PALE);
    await expect(page.getByRole("main").getByRole("status")).toHaveText(BRANDING_SAVED);
    await expect(hexField(page)).toHaveValue(PALE);
    await page.emulateMedia({ colorScheme: "light" });
    expect(await background(saveButton(page))).toBe(PALE_ON_LIGHT);

    await save(page, "not a colour");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(BRANDING_INVALID);
  });
});
