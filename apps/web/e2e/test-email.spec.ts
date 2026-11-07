import type { Page } from "@playwright/test";
import { TEST_EMAIL_SUBJECT } from "../src/emails/test-email";
import {
  SEND_TEST_EMAIL,
  SENDING_TEST_EMAIL,
  TEST_EMAIL_FAILED,
  TEST_EMAIL_FORBIDDEN,
  TEST_EMAIL_QUEUED,
} from "../src/lib/auth/messages";
import { searchMessages } from "../src/test/mailpit";
import { expect, test } from "./fixtures";
import { createWorkspace, failServerActions, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Plan Task 27 Step 4: /settings/email → server action → email.send job → worker → Mailpit. The worker runs beside the
// app (playwright.config.ts) and Mailpit's API is at MAILPIT_URL or localhost:8025 (src/test/mailpit.ts).

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

// A new user who creates a workspace (so is its Owner) and opens /settings/email from the nav.
async function openAsOwner(page: Page): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Mail Studio");
  const link = page.getByRole("link", { name: "Email", exact: true });
  await link.click();
  await expect(page).toHaveURL(/\/settings\/email$/);
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Email" })).toBeVisible();
  return email;
}

async function expectOneMessage(email: string): Promise<void> {
  await expect.poll(async () => (await searchMessages(email)).length, { timeout: 30_000 }).toBe(1);
  const [message] = await searchMessages(email);
  expect(message?.Subject).toBe(TEST_EMAIL_SUBJECT);
}

// The worker polls every 2 s: a job enqueued by mistake would have been sent by then.
async function expectNoMessage(page: Page, email: string): Promise<void> {
  await page.waitForTimeout(6_000);
  expect(await searchMessages(email)).toEqual([]);
}

test("an Owner's failed sends show the retry message and send nothing; the next send queues one email", async ({ page }) => {
  const email = await openAsOwner(page);
  const button = page.getByRole("button", { name: SEND_TEST_EMAIL });
  const alert = page.getByRole("main").getByRole("alert");

  for (const failure of ["server", "network"] as const) {
    await page.reload();
    const restore = await failServerActions(page, failure);
    await button.click();
    await expect(alert, failure).toHaveText(TEST_EMAIL_FAILED);
    await expect(button, failure).toHaveAttribute("aria-describedby", "send-test-email-error");
    await expect(alert, failure).toHaveId("send-test-email-error");
    await restore();
  }
  await expectNoMessage(page, email);

  await button.click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(TEST_EMAIL_QUEUED);
  await expect(alert).toHaveCount(0);
  await expect(button).not.toHaveAttribute("aria-describedby");
  await expectOneMessage(email);
});

test("Staff get no Email link, no form, and FORBIDDEN from a post of the page they had open (AUTH-02)", async ({ page }) => {
  const email = await openAsOwner(page);
  await setMemberRole(email, "staff");

  // The page still shows the form it rendered for the Owner; the action checks the role again.
  await page.getByRole("button", { name: SEND_TEST_EMAIL }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(TEST_EMAIL_FORBIDDEN);

  await page.reload();
  await expect(page.getByRole("link", { name: "Email", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText(TEST_EMAIL_FORBIDDEN);
  await expect(page.getByRole("main").locator("form")).toHaveCount(0);
  await expectNoMessage(page, email);
});

test("while the post is in flight the button reads Sending… and is disabled; then the status shows", async ({ page }) => {
  const email = await openAsOwner(page);
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !(await request.headerValue("next-action"))) return route.fallback();
    await released;
    return route.fallback();
  });

  await page.getByRole("button", { name: SEND_TEST_EMAIL }).click();
  await expect(page.getByRole("button", { name: SENDING_TEST_EMAIL })).toBeDisabled();
  await expect(page.getByRole("main").getByRole("status")).toHaveCount(0);

  release();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(TEST_EMAIL_QUEUED);
  const button = page.getByRole("button", { name: SEND_TEST_EMAIL });
  await expect(button).toBeEnabled();
  await expect(button).toBeFocused();
  await expectOneMessage(email);
});
