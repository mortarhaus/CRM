import type { Page } from "@playwright/test";
import {
  TEMPLATE_DRAFT_NOT_KEPT,
  TEMPLATE_INVALID,
  TEMPLATE_IS_DEFAULT,
  TEMPLATE_MALFORMED_PLACEHOLDER,
  TEMPLATE_RESTORE,
  TEMPLATE_RESTORED,
  TEMPLATE_SAVE,
  TEMPLATE_SAVED,
  TEMPLATE_STALE,
  TEMPLATE_SUBJECT_REFUSED,
  TEMPLATES_FORBIDDEN,
  TEMPLATES_INTRO,
  unknownFieldsMessage,
} from "../src/lib/auth/messages";
import { expectAccessible, expectVisibleFocus, tabTo } from "./a11y";
import { expect, test } from "./fixtures";
import { createWorkspace, openShellMenu, respectRateLimit, setMemberRole, signIn, signUp, uniqueEmail } from "./helpers";

// Phase 2 plan Task 25: the email templates page (Admin and Owner): the Q23 defaults, an audited save, an unknown field
// refused at save time, the watermarked preview with sample data, and restoring the default. Kept short: CI runs
// every spec at three widths, and expectAccessible checks the 320px page does not overflow.
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // An unclosed field: no preview, never a half-filled one.
  await page.getByLabel("Message").fill("Hi {{client_name");
  await expect(preview(page)).toContainText(TEMPLATE_MALFORMED_PLACEHOLDER);

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
  // Saved text is not sent yet, the owner email included (PR 76 Review R1 P2).
  await expect(main(page).getByText(TEMPLATES_INTRO)).toBeVisible();
  await expectAccessible(page, "/settings/templates, owner notification");
});

// PR 76 Review R1 P1 (A11Y-01, A11Y-03, A11Y-06): the editor by keyboard alone, at every width. Each Tab on the way
// must show focus (tabTo). After a post, focus returns to Save and the outcome is announced (role alert or status).
test("by keyboard: choose an email, edit, a refusal, save, a stale save, restore", async ({ page }) => {
  await newOwner(page);
  await page.goto("/settings/templates");
  const subject = page.getByLabel("Subject");
  const save = page.getByRole("button", { name: TEMPLATE_SAVE });
  const toSubjectFromSave = async () => {
    // Back past the message to the subject.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await expectVisibleFocus(subject);
  };
  const retype = async (text: string) => {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(text);
  };

  await tabTo(page, page.getByRole("link", { name: "Quote sent" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?event=quote_sent$/);
  await expect(page.getByRole("link", { name: "Quote sent" })).toHaveAttribute("aria-current", "page");

  // A refusal: the reason is announced and linked to the field, the draft stays, focus is back on Save.
  await tabTo(page, subject);
  await retype("Quote {{quote_no}}");
  await tabTo(page, save);
  await page.keyboard.press("Enter");
  await expect(main(page).getByRole("alert")).toHaveText(TEMPLATE_INVALID);
  await expect(save).toBeFocused();
  await expect(subject).toHaveValue("Quote {{quote_no}}");
  await expect(subject).toHaveAttribute("aria-invalid", "true");
  await expect(subject).toHaveAccessibleDescription(new RegExp("\\{\\{quote_no\\}\\} is not a field"));

  // The corrected text saves with Space on Save.
  await toSubjectFromSave();
  await retype("Quote {{quote_number}} is ready");
  await tabTo(page, save);
  await page.keyboard.press("Space");
  await expect(main(page).getByRole("status")).toHaveText(TEMPLATE_SAVED);
  await expect(save).toBeFocused();
  await expect(subject).not.toHaveAttribute("aria-invalid");

  // Someone else saves the same template in another tab; this tab's save is refused as stale, focus back on Save.
  const other = await page.context().newPage();
  await other.goto("/settings/templates?event=quote_sent");
  await other.getByLabel("Subject").fill("Quote {{quote_number}} from the other tab");
  await other.getByRole("button", { name: TEMPLATE_SAVE }).click();
  await expect(other.getByRole("main").getByRole("status")).toHaveText(TEMPLATE_SAVED);
  await other.close();
  await toSubjectFromSave();
  await retype("Quote {{quote_number}} from this tab");
  await tabTo(page, save);
  await page.keyboard.press("Enter");
  await expect(main(page).getByRole("alert")).toHaveText(TEMPLATE_STALE);
  await expect(save).toBeFocused();
  await expectAccessible(page, "/settings/templates, stale");

  // After a reload, restore the default by keyboard.
  await page.reload();
  await expect(subject).toHaveValue("Quote {{quote_number}} from the other tab");
  // Through the email links (the current one first), then on to Restore: the tab order follows the page.
  await tabTo(page, page.getByRole("link", { name: "Quote sent" }));
  await tabTo(page, page.getByRole("button", { name: TEMPLATE_RESTORE }));
  await page.keyboard.press("Enter");
  await expect(main(page).getByRole("status")).toHaveText(TEMPLATE_RESTORED);
  await expect(save).toBeFocused();
  await expect(subject).toHaveValue("Quote {{quote_number}} from {{workspace_name}}");
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

  // The refusal carries no posted text (PR 76 Review R1), so the page shows the saved text again, says the change was
  // not kept and gives the field's rule; the corrected post saves.
  test("a refused template names the field and says the draft was not kept; the corrected post saves", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "the form is the same at every width; run once to keep the suite short");
    await newOwner(page);
    await page.goto("/settings/templates?event=quote_sent");
    await page.getByLabel("Subject").fill("Quote {{quote_no}} for aisha.private@example.test");
    await page.getByRole("button", { name: TEMPLATE_SAVE }).click();
    await expect(main(page).getByRole("alert")).toHaveText(`${TEMPLATE_INVALID} ${TEMPLATE_DRAFT_NOT_KEPT}`);
    await expect(page.getByLabel("Subject")).toHaveValue("Quote {{quote_number}} from {{workspace_name}}");
    await expect(page.getByLabel("Subject")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Subject")).toHaveAccessibleDescription(new RegExp(escapeRegExp(TEMPLATE_SUBJECT_REFUSED)));
    await expect(main(page)).not.toContainText("aisha.private@example.test");
    await page.getByLabel("Subject").fill("Quote {{quote_number}}");
    await page.getByRole("button", { name: TEMPLATE_SAVE }).click();
    await expect(main(page).getByRole("status")).toHaveText(TEMPLATE_SAVED);
  });
});
