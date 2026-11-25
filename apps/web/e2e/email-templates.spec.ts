import type { Page } from "@playwright/test";
import {
  TEMPLATE_INVALID,
  TEMPLATE_IS_DEFAULT,
  TEMPLATE_RESTORE,
  TEMPLATE_RESTORED,
  TEMPLATE_SAVE,
  TEMPLATE_SAVED,
  TEMPLATES_FORBIDDEN,
  unknownFieldsMessage,
} from "../src/lib/auth/messages";
import { expectAccessible } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, openShellMenu, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Phase 2 plan Task 25: the email templates page (Admin and Owner): the Q23 defaults, an audited save, an unknown field
// refused at save time, the watermarked preview with sample data, and restoring the default. Kept short: the image job
// runs every spec at three widths, and expectAccessible checks the 320px page does not overflow.
let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

async function newOwner(page: Page): Promise<string> {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Templates Studio");
  return email;
}

const main = (page: Page) => page.getByRole("main");
const preview = (page: Page) => main(page).getByRole("region", { name: "Preview" });

test("an Owner previews, edits, is refused an unknown field, saves and restores the default", async ({ page }) => {
  await newOwner(page);
  await openShellMenu(page);
  await page.getByRole("link", { name: "Templates" }).click();
  await expect(page).toHaveURL(/\/settings\/templates$/);
  await expect(page.getByRole("heading", { level: 1, name: "Email templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Invoice sent" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Subject")).toHaveValue("Invoice {{invoice_number}} from {{workspace_name}}");
  await expect(main(page).getByText(TEMPLATE_IS_DEFAULT)).toBeVisible();
  // The preview is watermarked and filled with sample data, never the field names.
  await expect(preview(page)).toContainText("Invoice INV-STU-2026-0042 from Your Studio");
  await expect(preview(page)).not.toContainText("{{");
  await expectAccessible(page, "/settings/templates, default");

  // An unknown field: no preview, and the save is refused on the field it is in.
  await page.getByLabel("Message").fill("Hi {{client_name}}, your {{password}}");
  await expect(preview(page)).toContainText(unknownFieldsMessage(["password"]));
  await page.getByRole("button", { name: TEMPLATE_SAVE }).click();
  await expect(main(page).getByRole("alert")).toHaveText(TEMPLATE_INVALID);
  await expect(page.getByLabel("Message")).toHaveAccessibleDescription(new RegExp("\\{\\{password\\}\\} is not a field"));
  await expectAccessible(page, "/settings/templates, refused");

  // A value that looks like markup is shown as text in the preview.
  await page.getByLabel("Subject").fill("<b>Invoice</b> {{invoice_number}}");
  await page.getByLabel("Message").fill("Hi {{client_name}},\n\nPay here: {{invoice_link}}");
  await expect(preview(page)).toContainText("<b>Invoice</b> INV-STU-2026-0042");
  await page.getByRole("button", { name: TEMPLATE_SAVE }).click();
  await expect(main(page).getByRole("status")).toHaveText(TEMPLATE_SAVED);
  await page.reload();
  await expect(page.getByLabel("Subject")).toHaveValue("<b>Invoice</b> {{invoice_number}}");
  await expect(main(page).getByText(TEMPLATE_IS_DEFAULT)).toHaveCount(0);

  await page.getByRole("button", { name: TEMPLATE_RESTORE }).click();
  await expect(main(page).getByRole("status")).toHaveText(TEMPLATE_RESTORED);
  await expect(page.getByLabel("Subject")).toHaveValue("Invoice {{invoice_number}} from {{workspace_name}}");
  await expect(page.getByRole("button", { name: TEMPLATE_RESTORE })).toHaveCount(0);

  // Another event shows its own default and fields.
  await page.getByRole("link", { name: "Payment details changed (to the owner)" }).click();
  await expect(page.getByLabel("Subject")).toHaveValue("Payment details changed on {{workspace_name}}");
  await expect(preview(page)).toContainText("Hi Siti Rahim,");
  await expect(preview(page)).toContainText("The payment details for Your Studio were changed on 10-Dec-2026 09:15 (Asia/Kuala_Lumpur) by Ben Tan.");
  await expect(page.getByText("{{client_name}}")).toHaveCount(0);
  await expectAccessible(page, "/settings/templates, owner notification");
});

test("Staff get the refusal, not the templates, and no Templates link", async ({ page }) => {
  const email = await newOwner(page);
  await setMemberRole(email, "staff");
  await page.goto("/settings/templates");
  await expect(main(page).getByText(TEMPLATES_FORBIDDEN)).toBeVisible();
  await expect(page.getByLabel("Subject")).toHaveCount(0);
  await openShellMenu(page);
  await expect(page.getByRole("link", { name: "Templates" })).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a refused template comes back as typed with its reason; the fixed post saves", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "the form is the same at every width; run once to keep the suite short");
    await newOwner(page);
    await page.goto("/settings/templates?event=quote_sent");
    await page.getByLabel("Subject").fill("Quote {{quote_no}}");
    await page.getByRole("button", { name: TEMPLATE_SAVE }).click();
    await expect(page.getByLabel("Subject")).toHaveValue("Quote {{quote_no}}");
    await expect(main(page).getByText(unknownFieldsMessage(["quote_no"])).first()).toBeVisible();
    await page.getByLabel("Subject").fill("Quote {{quote_number}}");
    await page.getByRole("button", { name: TEMPLATE_SAVE }).click();
    await expect(main(page).getByRole("status")).toHaveText(TEMPLATE_SAVED);
  });
});
