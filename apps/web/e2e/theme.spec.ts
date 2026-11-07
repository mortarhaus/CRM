import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { createWorkspace, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

// Plan Task 3: the theme is a cookie set by a plain form post and rendered as a class on <html> by the server.

async function signedInWithWorkspace(page: Page): Promise<void> {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Theme Studio");
}

async function chooseTheme(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name }).click();
  await expect(page.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
}

const html = (page: Page) => page.locator("html");

test("the chosen theme survives a reload and beats the system setting; system follows it again", async ({ page }) => {
  await signedInWithWorkspace(page);
  await page.emulateMedia({ colorScheme: "light" });

  await chooseTheme(page, "Dark theme");
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html(page)).toHaveClass(/\bdark\b/);
  await expect(page).toHaveURL(/\/workspaces$/);

  const cookie = (await page.context().cookies()).find(({ name }) => name === "crm_theme");
  expect(cookie).toMatchObject({ value: "dark", httpOnly: true, sameSite: "Lax", path: "/" });

  await chooseTheme(page, "System theme");
  await expect(html(page)).not.toHaveClass(/\b(dark|light)\b/);
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await background()).toBe("rgb(244, 247, 251)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background()).toBe("rgb(8, 12, 16)");
});

test("the theme route refuses a cross-site post and an unknown theme", async ({ page }) => {
  await signedInWithWorkspace(page);
  const origin = new URL(page.url()).origin;
  const crossSite = await page.request.post("/theme", {
    form: { theme: "dark" },
    headers: { origin: "https://attacker.example.test" },
    maxRedirects: 0,
  });
  expect(crossSite.status()).toBe(403);
  const unknown = await page.request.post("/theme", { form: { theme: "neon" }, headers: { origin }, maxRedirects: 0 });
  expect(unknown.status()).toBe(400);
  expect((await page.context().cookies()).some(({ name }) => name === "crm_theme")).toBe(false);
});

test("the theme route sends a signed-out post to sign in and sets no cookie", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const response = await page.request.post("/theme", { form: { theme: "dark" }, headers: { origin }, maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toMatch(/\/sign-in$/);
  expect(response.headers()["set-cookie"] ?? "").not.toContain("crm_theme");
  expect((await page.context().cookies()).some(({ name }) => name === "crm_theme")).toBe(false);
});

test("with reduced motion the cards do not animate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signedInWithWorkspace(page);
  await page.reload();
  const card = page.getByRole("list", { name: "Your workspaces" }).getByRole("listitem").first();
  await expect(card).toBeVisible();
  expect(await card.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await card.evaluate((element) => getComputedStyle(element).animationName)).toBe("card-enter");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the theme form still sets the theme", async ({ page }) => {
    await signedInWithWorkspace(page);
    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page).toHaveURL(/\/workspaces$/);
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(html(page)).toHaveClass(/\blight\b/);
  });
});
