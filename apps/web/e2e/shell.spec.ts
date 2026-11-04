import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import { expectAccessible } from "./a11y";
import { expectDrawerOpen, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

// The app shell (plan Task 2; PR #53 R1): below md a sticky top bar, a floating tab bar and a menu drawer, as in the
// Kinlo sample (Charlie, 2026-11-04); from md up the icon rail and the full top bar.

const MD = 768;

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText(name);
}

// A new Owner of one workspace, so every destination (Email included) is in the navigation.
async function signedInOwner(page: Page): Promise<void> {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Shell Studio");
}

function isPhone(page: Page): boolean {
  return (page.viewportSize()?.width ?? MD) < MD;
}

const menuButton = (page: Page) => page.getByRole("button", { name: "Open menu" });
const drawer = (page: Page) => page.getByRole("dialog", { name: "Menu" });
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Quick" });

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error(`no box: ${locator.toString()}`);
  return rect;
}

test("below md a tab bar and a menu button; from md up the rail and no tab bar", async ({ page }) => {
  await signedInOwner(page);
  if (isPhone(page)) {
    await expect(tabBar(page)).toBeVisible();
    await expect(menuButton(page)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    for (const name of ["Workspaces", "Security", "Email"]) {
      await expect(tabBar(page).getByRole("link", { name })).toBeVisible();
    }
    // The current page is the filled item.
    await expect(tabBar(page).getByRole("link", { name: "Workspaces" })).toHaveAttribute("aria-current", "page");
    // The bar floats inside the viewport, inset from its edges.
    const bar = await box(tabBar(page));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    expect(bar.x).toBeGreaterThan(0);
    expect(bar.x + bar.width).toBeLessThan(viewport.width);
    expect(bar.y + bar.height).toBeLessThan(viewport.height);
  } else {
    await expect(tabBar(page)).toBeHidden();
    await expect(menuButton(page)).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Active workspace" })).toBeVisible();
  }
});

test("the menu drawer opens from the menu button, is modal, and Esc or Close returns focus to the button", async ({
  page,
}) => {
  test.skip(!isPhone(page), "the drawer is the phone layout only");
  await signedInOwner(page);

  const button = menuButton(page);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toHaveAttribute("aria-controls", "shell-menu");
  await button.click();
  await expect(drawer(page)).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  // A modal dialog: the page behind it is inert.
  expect(await drawer(page).evaluate((dialog) => dialog.matches(":modal"))).toBe(true);
  for (const name of ["Workspaces", "Security", "Email"]) {
    await expect(drawer(page).getByRole("link", { name })).toBeVisible();
  }
  await expect(drawer(page).getByRole("combobox", { name: "Active workspace" })).toBeVisible();
  await expect(drawer(page).getByRole("button", { name: "Sign out" })).toBeVisible();
  // Tab never reaches the page behind: past the last control focus leaves for the browser's own UI (the document in a
  // headless browser), as a native modal dialog does, then comes back to the drawer.
  const focusPlaces = new Set<string>();
  for (let presses = 0; presses < 10; presses += 1) {
    await page.keyboard.press("Tab");
    focusPlaces.add(
      await drawer(page).evaluate((dialog) =>
        dialog.contains(document.activeElement) ? "drawer" : document.activeElement === document.body ? "browser" : "page",
      ),
    );
  }
  expect([...focusPlaces].sort()).toEqual(["browser", "drawer"]);

  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.press("Enter");
  await expect(drawer(page)).toBeVisible();
  await drawer(page).getByRole("button", { name: "Close menu" }).click();
  await expect(drawer(page)).toBeHidden();
  await expect(button).toBeFocused();

  // Choosing a link navigates and closes the drawer.
  await button.click();
  await drawer(page).getByRole("link", { name: "Security" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(drawer(page)).toBeHidden();
  await expect(tabBar(page).getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "page");
});

test("axe with the menu drawer open, light and dark", async ({ page }) => {
  test.skip(!isPhone(page), "the drawer is the phone layout only");
  await signedInOwner(page);
  await menuButton(page).click();
  await expect(drawer(page)).toBeVisible();
  // No crm_theme cookie: expectAccessible scans with the system scheme light, then dark.
  await expectAccessible(page, "/workspaces menu drawer open");
  await drawer(page).getByRole("button", { name: "Close menu" }).click();

  for (const theme of ["Dark", "Light"]) {
    await page.getByRole("button", { name: `${theme} theme` }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme.toLowerCase()}\\b`));
    await menuButton(page).click();
    await expect(drawer(page)).toBeVisible();
    await expectAccessible(page, `/workspaces menu drawer open, ${theme.toLowerCase()} theme chosen`);
    await page.keyboard.press("Escape");
  }
});

test("the New menu opens inside the viewport and closes on Esc", async ({ page }) => {
  await signedInOwner(page);
  const summary = page.getByText("New", { exact: true });
  await summary.click();
  const link = page.getByRole("link", { name: "Workspace", exact: true });
  await expect(link).toBeVisible();
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const rect = await box(link);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  await expectAccessible(page, "/workspaces New menu open");

  await page.keyboard.press("Escape");
  await expect(link).toBeHidden();
});

test("the tab bar never covers the focused control or the end of the page", async ({ page }) => {
  test.skip(!isPhone(page), "the tab bar is the phone layout only");
  await signedInOwner(page);
  // A short screen and a long list, so the form is below the fold.
  await page.setViewportSize({ width: 320, height: 480 });
  for (const name of ["Studio Two", "Studio Three", "Studio Four", "Studio Five"]) await createWorkspace(page, name);
  await page.evaluate(() => window.scrollTo(0, 0));

  // Tab from the name field to the last control of the form: the browser scrolls it into view.
  await page.getByLabel("Workspace name").focus();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("Tab");
  const submit = page.getByRole("button", { name: "Create workspace" });
  await expect(submit).toBeFocused();
  const bar = await box(tabBar(page));
  const control = await box(submit);
  expect(control.y + control.height, "the focused button is under the tab bar").toBeLessThanOrEqual(bar.y);

  // Chromium centres a control it scrolls to on focus; other browsers scroll only as far as needed, which the page's
  // scroll-padding must keep clear of the bar.
  await page.evaluate(() => window.scrollTo(0, 0));
  await submit.evaluate((element) => element.scrollIntoView({ block: "nearest" }));
  const nearest = await box(submit);
  expect(nearest.y + nearest.height, "a control scrolled just into view is under the tab bar").toBeLessThanOrEqual(bar.y);

  // Scrolled to the very end, the last control is still clear of the bar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const atEnd = await box(submit);
  expect(atEnd.y + atEnd.height, "the page's last control is under the tab bar").toBeLessThanOrEqual(bar.y);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the menu drawer opens and closes", async ({ page }) => {
    test.skip(!isPhone(page), "the drawer is the phone layout only");
    await signedInOwner(page);
    await menuButton(page).click();
    await expectDrawerOpen(drawer(page));
    await expect(drawer(page).getByRole("button", { name: "Sign out" })).toBeVisible();
    await drawer(page).getByRole("button", { name: "Close menu" }).click();
    await expect(drawer(page)).toBeHidden();

    await menuButton(page).click();
    await expectDrawerOpen(drawer(page));
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();

    await menuButton(page).click();
    await expectDrawerOpen(drawer(page));
    await drawer(page).getByRole("link", { name: "Security" }).click();
    await expect(page).toHaveURL(/\/settings\/security$/);
    await expect(drawer(page)).toBeHidden();
  });
});
