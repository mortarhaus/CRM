import { expect, test, testClientIp } from "./fixtures";
import type { Page } from "@playwright/test";
import { LOGO_MAX_BYTES } from "@crm/core/security";
import {
  BRANDING_FORBIDDEN,
  LOGO_ALT,
  LOGO_NONE,
  LOGO_SAVED,
  LOGO_TOO_LARGE,
  LOGO_TYPE_NOT_ALLOWED,
  UPLOAD_LOGO,
} from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { createWorkspace, recordCspViolations, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Phase 2 plan Task 12: the logo upload on the branding page and its same-origin serve route (img-src 'self').
// A real 1x1 PNG, so the browser decodes it.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');

function oversizePng(): Buffer {
  const bytes = Buffer.alloc(LOGO_MAX_BYTES + 1);
  PNG.copy(bytes);
  return bytes;
}

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

// A new user who creates a workspace (so is its Owner) and opens /settings/branding.
async function openAsOwner(page: Page, workspace = "Logo Studio"): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, workspace);
  await page.goto("/settings/branding");
  await expect(page.getByRole("heading", { level: 2, name: "Logo" })).toBeVisible();
  return email;
}

const fileField = (page: Page) => page.getByLabel("Logo file", { exact: true });
const uploadButton = (page: Page) => page.getByRole("button", { name: UPLOAD_LOGO });
const logo = (page: Page) => page.getByRole("main").getByRole("img", { name: LOGO_ALT });

async function upload(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<void> {
  await fileField(page).setInputFiles({ name, mimeType, buffer });
  await uploadButton(page).click();
}

async function expectRendered(page: Page): Promise<void> {
  await expect(logo(page)).toBeVisible();
  await expect.poll(() => logo(page).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(1);
}

test("an uploaded PNG renders from the same-origin route, after a reload too, with no CSP violation", async ({ page }) => {
  const violations = await recordCspViolations(page);
  await openAsOwner(page);
  await expect(page.getByRole("main")).toContainText(LOGO_NONE);

  await upload(page, "logo.png", "image/png", PNG);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(LOGO_SAVED);
  await expect(uploadButton(page)).toBeFocused();
  await expectRendered(page);
  const src = await logo(page).getAttribute("src");
  expect(src).toMatch(/^\/files\/logo\?id=[0-9a-f-]{36}$/);

  await page.reload();
  await expectRendered(page);
  const response = await page.request.get(src ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()).toMatchObject({
    "content-type": "image/png",
    "x-content-type-options": "nosniff",
    "content-disposition": "attachment",
    "cache-control": "private, max-age=3600",
  });
  expect(violations).toEqual([]);
  await expectAccessible(page, "/settings/branding with a logo");
});

test("an SVG renamed .png and an oversize file are refused with a clear message linked to the field", async ({ page }) => {
  await openAsOwner(page);
  await upload(page, "logo.png", "image/png", SVG);
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toHaveText(LOGO_TYPE_NOT_ALLOWED);
  await expect(fileField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(fileField(page)).toHaveAttribute("aria-describedby", "logo-hint logo-error");
  await expect(uploadButton(page)).toBeFocused();
  await expectAccessible(page, "/settings/branding, refused logo");
  await expect(page.getByRole("main")).toContainText(LOGO_NONE);

  // Refused in the browser before it is sent; the server refuses it too (the test without JavaScript below).
  await upload(page, "big.png", "image/png", oversizePng());
  await expect(alert).toHaveText(LOGO_TOO_LARGE);
  await expect(page.getByRole("main")).toContainText(LOGO_NONE);
});

test("Staff cannot upload: FORBIDDEN from a post of the page they had open, and no form after (AUTH-02)", async ({ page }) => {
  const email = await openAsOwner(page);
  await setMemberRole(email, "staff");

  await upload(page, "logo.png", "image/png", PNG);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(BRANDING_FORBIDDEN);

  await page.reload();
  await expect(page.getByRole("main")).toContainText(BRANDING_FORBIDDEN);
  await expect(fileField(page)).toHaveCount(0);
});

test("a member of another workspace gets 404 for the first workspace's logo (TEN-05)", async ({ page, browser }) => {
  await openAsOwner(page, "Logo A");
  await upload(page, "logo.png", "image/png", PNG);
  await expectRendered(page);
  const src = (await logo(page).getAttribute("src")) ?? "";

  const newContext = () =>
    browser.newContext({ baseURL: new URL(page.url()).origin, extraHTTPHeaders: { "x-forwarded-for": testClientIp() } });
  const other = await newContext();
  const signedOut = await newContext();
  try {
    const second = await other.newPage();
    const email = uniqueEmail();
    await signUp(second, email);
    await signIn(second, email);
    await createWorkspace(second, "Logo B");
    expect((await second.request.get(src)).status()).toBe(404);
    expect((await signedOut.request.get(src)).status()).toBe(404);
  } finally {
    await Promise.all([other.close(), signedOut.close()]);
  }
  expect((await page.request.get(src)).status()).toBe(200);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the logo uploads through a plain multipart form post", async ({ page }) => {
    await openAsOwner(page, "No Script Logo");
    await upload(page, "logo.png", "image/png", PNG);
    await expect(page.getByRole("main").getByRole("status")).toHaveText(LOGO_SAVED);
    await expectRendered(page);

    await upload(page, "logo.png", "image/png", SVG);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(LOGO_TYPE_NOT_ALLOWED);

    // No browser check without JavaScript: the server refuses it (under the server-action body limit, next.config.ts).
    await upload(page, "big.png", "image/png", oversizePng());
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(LOGO_TOO_LARGE);
  });
});
