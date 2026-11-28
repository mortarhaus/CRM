import { createHash } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";
import type { TOTP } from "otpauth";
import { BANK_DETAILS_CHANGED_DEFAULT } from "../src/emails/bank-details-changed";
import {
  BANK_SAVED,
  PAYMENT_CHANGE_FORBIDDEN,
  PAYMENT_FORBIDDEN,
  PAYMENT_QR_SAVED,
  PAYMENT_VIEW_ENROL,
  STEP_UP_CONFIRMED,
  STEP_UP_ENROL,
  STEP_UP_EXPIRED,
  WRONG_CODE,
} from "../src/lib/auth/messages";
import { getMessage, searchMessages } from "../src/test/mailpit";
import { expireStepUp, storedObjectExists, workspaceIdOf } from "../src/test/payment-e2e";
import { totpFromUri, wrongTotpCode } from "../src/test/totp";
import { expectAccessible, tabTo } from "./a11y";
import { expect, test } from "./fixtures";
import {
  closeShellMenu,
  createWorkspace,
  openShellMenu,
  PASSWORD,
  respectRateLimit,
  setMemberRole,
  setTwoFactorEnabled,
  signIn,
  signUp,
  submitTotpCode,
  switchTo,
  uniqueEmail,
} from "./helpers";

// Phase 2 PR 5c (plan Task 16; Bob's PR 70 deferred conditions): /settings/payment in a real browser. Step-up (wrong
// code, right code, expiry while the page is open), the bank save, the QR upload and replace, the Owner-only rule, the
// owner email in Mailpit, keyboard and axe at every project width (playwright.config.ts), and no horizontal overflow
// with a long bank name. QR uploads need storage: STORAGE_* for `pnpm dev`, or the image stack (docs/runbooks).

const ACCOUNT_NUMBER = "5140123456789";
const HOLDER = "Studio Holder Sdn Bhd";
// FE-71: the longest bank name the field takes (SETTINGS_TEXT_MAX_LENGTH is larger; 100 is the brief's test length).
const LONG_BANK_NAME = `Bank ${"Kerjasama Rakyat Malaysia Berhad ".repeat(3)}`.padEnd(100, "X").slice(0, 100);

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

// A real PNG of the given size (one grey RGB pixel row repeated), so the browser decodes it at its own proportions.
function png(width: number, height: number, shade = 0x80): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, shade)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Better Auth accepts a code for a while and step-up refuses a code used before (one use per code), so each check
// waits for a code no earlier step has used.
async function freshCode(page: Page, totp: TOTP, used: Set<string>): Promise<string> {
  for (;;) {
    const code = totp.generate();
    if (!used.has(code)) {
      used.add(code);
      return code;
    }
    await page.waitForTimeout(1_000);
  }
}

interface Owner {
  email: string;
  workspace: string;
  totp: TOTP;
  used: Set<string>;
}

// A new Owner with 2FA on, on /settings/payment with the step-up prompt showing.
async function openAsOwner(page: Page, workspace: string): Promise<Owner> {
  const email = uniqueEmail();
  await signUp(page, email, PASSWORD, "Aisha Owner");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, workspace);
  await page.goto("/settings/security");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const totp = totpFromUri((await page.getByTestId("totp-uri").textContent())?.trim() ?? "");
  const used = new Set<string>();
  await submitTotpCode(page, await freshCode(page, totp, used));
  await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");
  await page.goto("/settings/payment");
  await expect(page.getByRole("heading", { level: 1, name: "Bank details" })).toBeVisible();
  return { email, workspace, totp, used };
}

const codeField = (page: Page) => page.getByLabel("Authentication code");
const confirmButton = (page: Page) => page.getByRole("button", { name: "Confirm", exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: "Save bank details" });
const bankForm = (page: Page) => page.locator("form").filter({ has: saveButton(page) });

async function stepUp(page: Page, owner: Owner): Promise<void> {
  await codeField(page).fill(await freshCode(page, owner.totp, owner.used));
  await confirmButton(page).click();
  await expect(page.getByRole("main").getByRole("status").first()).toHaveText(STEP_UP_CONFIRMED);
}

async function fillBank(page: Page, bankName: string): Promise<void> {
  await page.getByLabel("Bank name").fill(bankName);
  await page.getByLabel("Account holder name").fill(HOLDER);
  await page.getByLabel("Account number").fill(ACCOUNT_NUMBER);
  await page.getByLabel("SWIFT code").fill("MBBEMYKL");
}

// The owner emails for this Owner, waiting until there are `count`; checks the subject and that no bank value is in
// them (spec "Authorization"; the email never shows account numbers).
async function expectOwnerEmails(owner: Owner, count: number): Promise<string[]> {
  await expect.poll(async () => (await searchMessages(owner.email)).length, { timeout: 30_000 }).toBe(count);
  const bodies: string[] = [];
  for (const { ID } of await searchMessages(owner.email)) {
    const message = await getMessage(ID);
    expect(message.Subject).toBe(BANK_DETAILS_CHANGED_DEFAULT.subject.replace("{{workspace_name}}", owner.workspace));
    for (const value of [ACCOUNT_NUMBER, ACCOUNT_NUMBER.slice(-4), HOLDER, "MBBEMYKL"]) {
      expect(message.Text).not.toContain(value);
      expect(message.HTML).not.toContain(value);
    }
    bodies.push(message.Text.replace(/\s+/g, " "));
  }
  return bodies;
}

test("step-up: a wrong code is refused, the right one confirms; a long bank name saves and one email reaches the Owner", async ({
  page,
}) => {
  const owner = await openAsOwner(page, "Bank Studio");
  await expectAccessible(page, "/settings/payment, step-up prompt");

  await codeField(page).fill(wrongTotpCode(owner.totp));
  await confirmButton(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(WRONG_CODE);
  await expect(codeField(page)).toBeFocused();
  await expect(codeField(page)).toHaveAttribute("aria-invalid", "true");
  await expectAccessible(page, "/settings/payment, wrong code");

  await stepUp(page, owner);
  await fillBank(page, LONG_BANK_NAME);
  await saveButton(page).click();
  await expect(bankForm(page).getByRole("status")).toHaveText(BANK_SAVED);
  await expect(saveButton(page)).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("Bank name")).toHaveValue(LONG_BANK_NAME);
  await expectAccessible(page, "/settings/payment, 100-character bank name");

  const [body] = await expectOwnerEmails(owner, 1);
  expect(body).toContain("Hi Aisha Owner,");
  expect(body).toContain(`The payment details for ${owner.workspace} were changed on `);
  expect(body).toMatch(/changed on \d{2}-[A-Z][a-z]{2}-\d{4} \d{2}:\d{2} \(Asia\/Kuala_Lumpur\) by Aisha Owner\./);
  expect(body).toContain("What changed: bank details.");
});

test("expiry while the page is open: the prompt returns with focus on the code, typed values stay, the stale message clears", async ({
  page,
}) => {
  const owner = await openAsOwner(page, "Expiry Studio");
  await stepUp(page, owner);
  await fillBank(page, "Maybank");
  await expireStepUp(owner.email);

  await saveButton(page).click();
  await expect(bankForm(page).getByRole("alert")).toHaveText(STEP_UP_EXPIRED);
  await expect(codeField(page)).toBeVisible();
  await expect(codeField(page)).toBeFocused();
  await expect(page.getByLabel("Bank name")).toHaveValue("Maybank");
  await expect(page.getByLabel("Account number")).toHaveValue(ACCOUNT_NUMBER);
  await expectAccessible(page, "/settings/payment, step-up expired");

  await stepUp(page, owner);
  // Bob PR 70 R2 P3: the refusal is gone once the page says Confirmed again.
  await expect(bankForm(page).getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Bank name")).toHaveValue("Maybank");
  await saveButton(page).click();
  await expect(bankForm(page).getByRole("status")).toHaveText(BANK_SAVED);
  await expectOwnerEmails(owner, 1);
});

test("QR: a non-square image keeps its proportions in a fixed slot; a replacement keeps the old file in storage", async ({
  page,
}) => {
  const owner = await openAsOwner(page, "QR Studio");
  await stepUp(page, owner);
  const preview = page.getByRole("main").getByRole("img", { name: "Your DuitNow QR code" });
  const fileField = page.getByLabel("DuitNow QR image");
  const upload = page.getByRole("button", { name: "Upload QR code" });

  const wide = png(300, 120);
  await fileField.setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: wide });
  await upload.click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: PAYMENT_QR_SAVED })).toBeVisible();
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(300);
  // The frame fits the image (2.5:1, minus the padding and border), inside the 160 px high slot.
  const box = await preview.evaluate((image: HTMLImageElement) => ({
    ratio: image.clientWidth / image.clientHeight,
    slot: image.parentElement?.getBoundingClientRect().height,
  }));
  expect(box.ratio).toBeCloseTo(300 / 120, 0);
  expect(box.slot).toBe(160);
  await expectAccessible(page, "/settings/payment, wide QR");

  const oldSrc = (await preview.getAttribute("src")) ?? "";
  const square = png(200, 200, 0x40);
  await fileField.setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: square });
  await upload.click();
  const newHash = createHash("sha256").update(square).digest("hex");
  await expect(preview).toHaveAttribute("src", `/files/payment-qr?id=${newHash}`);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(200);
  expect(await preview.evaluate((image: HTMLImageElement) => image.clientWidth / image.clientHeight)).toBeCloseTo(1, 1);

  // Only the current QR is served; the replaced one stays in storage (spec line 847).
  expect((await page.request.get(oldSrc)).status()).toBe(404);
  const workspaceId = await workspaceIdOf(owner.email);
  const oldHash = createHash("sha256").update(wide).digest("hex");
  expect(await storedObjectExists(`ws/${workspaceId}/duitnow/${oldHash}.png`)).toBe(true);
  expect(await storedObjectExists(`ws/${workspaceId}/duitnow/${newHash}.png`)).toBe(true);

  const bodies = await expectOwnerEmails(owner, 2);
  for (const body of bodies) expect(body).toContain("What changed: the DuitNow QR.");
});

test("keyboard only: step up, fill and save the bank details with visible focus throughout", async ({ page }) => {
  const owner = await openAsOwner(page, "Keys Studio");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await tabTo(page, codeField(page));
  await page.keyboard.type(await freshCode(page, owner.totp, owner.used));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main").getByRole("status").first()).toHaveText(STEP_UP_CONFIRMED);

  for (const [label, value] of [
    ["Bank name", "Maybank"],
    ["Account holder name", HOLDER],
    ["Account number", ACCOUNT_NUMBER],
  ] as const) {
    const field = page.getByLabel(label);
    await tabTo(page, field);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(value);
  }
  await tabTo(page, saveButton(page));
  await page.keyboard.press("Enter");
  await expect(bankForm(page).getByRole("status")).toHaveText(BANK_SAVED);
  await expect(saveButton(page)).toBeFocused();
});

// Spec revision 13: an Admin with 2FA views the bank details and the QR, with no step-up and no forms; Staff are
// refused; the QR is refused to anyone without 2FA, also with require_2fa off (the workspace default here).
test("an Admin with 2FA sees the Bank link and a view-only page; Staff and members without 2FA see no details", async ({
  page,
}) => {
  const owner = await openAsOwner(page, "Admin Studio");
  await stepUp(page, owner);
  await fillBank(page, "Maybank");
  await saveButton(page).click();
  await expect(bankForm(page).getByRole("status")).toHaveText(BANK_SAVED);
  // The QR form still holds the version it was rendered with, so the page is loaded again first (step-up stays fresh).
  await page.reload();
  const qr = png(200, 200);
  await page.getByLabel("DuitNow QR image").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: qr });
  await page.getByRole("button", { name: "Upload QR code" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: PAYMENT_QR_SAVED })).toBeVisible();
  const qrUrl = `/files/payment-qr?id=${createHash("sha256").update(qr).digest("hex")}`;

  await setMemberRole(owner.email, "admin");
  await page.goto("/workspaces");
  // The full nav (the drawer below md); the quick bar never lists Bank.
  const nav = page.getByRole("navigation", { name: "Main" });
  await openShellMenu(page);
  await nav.getByRole("link", { name: "Bank", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/payment$/);
  await closeShellMenu(page);
  const main = page.getByRole("main");
  await expect(main).toContainText(PAYMENT_CHANGE_FORBIDDEN);
  for (const value of ["Maybank", HOLDER, ACCOUNT_NUMBER, "MBBEMYKL"]) {
    await expect(main.getByRole("definition").filter({ hasText: value })).toHaveCount(1);
  }
  const preview = main.getByRole("img", { name: "Your DuitNow QR code" });
  await expect(preview).toHaveAttribute("src", qrUrl);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(200);
  await expect(main.locator("form")).toHaveCount(0);
  await expect(codeField(page)).toHaveCount(0);
  const served = await page.request.get(qrUrl);
  expect(served.status()).toBe(200);
  expect(served.headers()["cache-control"]).toBe("private, max-age=3600, must-revalidate");
  await expectAccessible(page, "/settings/payment as Admin");

  await setMemberRole(owner.email, "staff");
  await page.reload();
  await expect(main).toContainText(PAYMENT_FORBIDDEN);
  await expect(main.getByRole("definition")).toHaveCount(0);
  await expect(main.getByRole("img")).toHaveCount(0);
  expect((await page.request.get(qrUrl)).status()).toBe(404);
  await openShellMenu(page);
  await expect(page.getByRole("link", { name: "Bank", exact: true })).toHaveCount(0);
  await closeShellMenu(page);
  await expectAccessible(page, "/settings/payment as Staff");

  // 2FA turned off (as if never enrolled): no values and no QR on the page, and the route refuses the member as Admin
  // and as Owner, with require_2fa off. Turning 2FA off ends the user's sessions (AUTH-07), so they sign in again.
  await setTwoFactorEnabled(owner.email, false);
  await signIn(page, owner.email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await switchTo(page, owner.workspace);
  for (const role of ["admin", "owner"] as const) {
    await setMemberRole(owner.email, role);
    await page.goto("/settings/payment");
    await expect(main).toContainText(role === "admin" ? PAYMENT_VIEW_ENROL : STEP_UP_ENROL);
    await expect(main.getByRole("definition")).toHaveCount(0);
    await expect(main.getByRole("img")).toHaveCount(0);
    expect((await page.request.get(qrUrl)).status()).toBe(404);
  }
});
