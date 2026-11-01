import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";
import { completeTotpSignIn, enrolTotp, respectRateLimit, signIn, signOut, signUp, uniqueEmail } from "./helpers";

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText(name);
}

async function expectActiveWorkspace(page: Page, name: string): Promise<void> {
  await expect(page.getByLabel("Active workspace").locator("option:checked")).toHaveText(name);
}

test("Phase 0 done-when: sign up, 2FA, create two workspaces, switch between them", async ({ page }) => {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  const totp = await enrolTotp(page);
  await signOut(page);
  await respectRateLimit(page);
  await signIn(page, email);
  await completeTotpSignIn(page, totp);

  await expect(page.getByText("You have no workspaces yet.")).toBeVisible();

  await createWorkspace(page, "Studio Alpha");
  await expectActiveWorkspace(page, "Studio Alpha");

  await createWorkspace(page, "Studio Beta");
  await expectActiveWorkspace(page, "Studio Beta");

  await page.getByLabel("Active workspace").selectOption({ label: "Studio Alpha" });
  await expectActiveWorkspace(page, "Studio Alpha");
  // The select shows the new value at once; wait for the server-rendered marker so the switch is saved.
  await expect(page.getByRole("listitem").filter({ hasText: "Studio Alpha" })).toContainText("(active)");

  await page.reload();
  await expectActiveWorkspace(page, "Studio Alpha");
  await expect(page.getByRole("list", { name: "Your workspaces" }).getByRole("listitem")).toHaveCount(2);
});

test("switching to a workspace you are not a member of is refused and never becomes active", async ({
  browser,
  page,
}) => {
  await respectRateLimit(page);
  const ownerEmail = uniqueEmail();
  await signUp(page, ownerEmail);
  await signIn(page, ownerEmail);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Owner Private");
  const foreignId = await page.getByLabel("Active workspace").locator("option:checked").getAttribute("value");
  expect(foreignId).toBeTruthy();

  const outsiderContext = await browser.newContext();
  const outsider = await outsiderContext.newPage();
  await respectRateLimit(outsider);
  const outsiderEmail = uniqueEmail();
  await signUp(outsider, outsiderEmail);
  await signIn(outsider, outsiderEmail);
  await expect(outsider).toHaveURL(/\/workspaces$/);
  await createWorkspace(outsider, "Outsider Own");

  const refusal = await outsider.evaluate(async (organizationId) => {
    const response = await fetch("/api/auth/organization/set-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    return { status: response.status, code: (await response.json()).code };
  }, foreignId);
  expect(refusal).toEqual({ status: 403, code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION" });

  const session = await (await outsider.request.get("/api/auth/get-session")).json();
  expect(session.session.activeOrganizationId).not.toBe(foreignId);

  await outsider.reload();
  await expect(outsider.getByRole("list", { name: "Your workspaces" })).not.toContainText("Owner Private");
  await expect(outsider.getByLabel("Active workspace").locator("option")).not.toContainText(["Owner Private"]);
  await outsiderContext.close();
});
