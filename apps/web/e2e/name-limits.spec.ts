import { NAME_MAX_LENGTH, WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { expect, test } from "./fixtures";
import { createWorkspace, PASSWORD, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

// UNI-02: the server counts characters (code points); an emoji is two UTF-16 units, so a native
// maxlength would cut these names at half the limit. With JavaScript on, they must arrive whole too.
test("names of emoji at the limit arrive whole and one over is refused visibly", async ({ page }) => {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email, PASSWORD, "😀".repeat(NAME_MAX_LENGTH));

  const tooLongName = "😀".repeat(NAME_MAX_LENGTH + 1);
  await respectRateLimit(page);
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(tooLongName);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(tooLongName);
  await page.getByLabel("Email", { exact: true }).fill(uniqueEmail());
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(`Use at most ${NAME_MAX_LENGTH} characters for your name.`);

  await respectRateLimit(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  const workspaces = page.getByRole("list", { name: "Your workspaces" });
  const workspaceName = "😀".repeat(WORKSPACE_NAME_MAX_LENGTH);
  await createWorkspace(page, workspaceName);
  await expect(workspaces).toContainText(workspaceName);

  const tooLongWorkspace = "😀".repeat(WORKSPACE_NAME_MAX_LENGTH + 1);
  await page.getByLabel("Workspace name").fill(tooLongWorkspace);
  await expect(page.getByLabel("Workspace name")).toHaveValue(tooLongWorkspace);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters for the workspace name.`,
  );
  await expect(workspaces.getByRole("listitem")).toHaveCount(1);
});
