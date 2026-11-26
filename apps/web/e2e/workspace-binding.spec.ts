import { GENERAL_SAVE, GENERAL_SAVED, WORKSPACE_CHANGED_MESSAGE } from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, respectRateLimit, signIn, signUp, switchTo, uniqueEmail } from "./helpers";

// PR 76 Review R1 P0, made shared (DECISIONS 2026-11-25): a settings form opened in one workspace and saved after
// another tab switched the session to another workspace saves nothing in either; reloading shows the active one.
test("a form opened before a workspace switch in another tab is refused and saves nothing", async ({ context, page }) => {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Binding Alpha");
  await createWorkspace(page, "Binding Beta");

  await page.goto("/settings/general");
  const shortCode = page.getByLabel("Short code");
  await expect(shortCode).toHaveValue("");

  const other = await context.newPage();
  await switchTo(other, "Binding Alpha");
  await other.close();

  // Keyboard only: type the code and submit with Enter from the field.
  await shortCode.focus();
  await page.keyboard.type("BND");
  await page.keyboard.press("Enter");
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toHaveText(WORKSPACE_CHANGED_MESSAGE);
  await expectAccessible(page, "general settings refused after a workspace switch");

  // The page is now Binding Alpha's: nothing was saved there, and a save from it is done.
  await page.reload();
  await expect(shortCode).toHaveValue("");
  await shortCode.fill("ALP");
  await page.getByRole("button", { name: GENERAL_SAVE }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(GENERAL_SAVED);

  // Nothing was saved in Binding Beta either.
  await switchTo(page, "Binding Beta");
  await page.goto("/settings/general");
  await expect(shortCode).toHaveValue("");
});
