import { randomUUID } from "node:crypto";
import { NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH, WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { expect, test, type APIResponse, type Locator, type Page } from "@playwright/test";
import { totpFromUri, wrongTotpCode } from "../src/test/totp";
import { tabTo } from "./a11y";
import { PASSWORD, respectRateLimit, signIn, signOut, signUp, uniqueEmail } from "./helpers";

// FE-32: every flow here runs in a browser with JavaScript off, so the forms post to their server
// actions as plain HTML forms and the server renders the result.
test.use({ javaScriptEnabled: false });

test.beforeEach(async ({ page }) => {
  await respectRateLimit(page);
});

function formWith(page: Page, label: string): Locator {
  return page.locator("form").filter({ has: page.getByLabel(label, { exact: true }) });
}

// Sends a rendered form the way a script could: every field the page put in it, some values replaced,
// and none of the browser's own checks (required, minlength, maxlength).
async function postForm(page: Page, form: Locator, values: Record<string, string>): Promise<APIResponse> {
  const fields: Record<string, string> = {};
  for (const input of await form.locator("input[name]").all()) {
    const name = await input.getAttribute("name");
    if (name) fields[name] = (await input.getAttribute("value")) ?? "";
  }
  return page.request.post(page.url(), {
    multipart: { ...fields, ...values },
    headers: { origin: new URL(page.url()).origin },
    maxRedirects: 0,
  });
}

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
}

async function enrolTotpThroughApi(page: Page): Promise<{ secret: string; uri: string; recoveryCodes: string[] }> {
  const origin = new URL(page.url()).origin;
  const enable = await page.request.post("/api/auth/two-factor/enable", {
    data: { password: PASSWORD },
    headers: { origin },
  });
  expect(enable.status()).toBe(200);
  const { totpURI, backupCodes } = (await enable.json()) as { totpURI: string; backupCodes: string[] };
  const verify = await page.request.post("/api/auth/two-factor/verify-totp", {
    data: { code: totpFromUri(totpURI).generate() },
    headers: { origin },
  });
  expect(verify.status()).toBe(200);
  return { secret: new URL(totpURI).searchParams.get("secret") ?? "", uri: totpURI, recoveryCodes: backupCodes };
}

test("sign-up and sign-in work without JavaScript, and the session cookie keeps its flags", async ({
  page,
  context,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page.getByRole("status")).toContainText("Sign in to continue");

  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();

  const session = (await context.cookies()).find((cookie) => cookie.name.endsWith("better-auth.session_token"));
  expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  expect(session?.secure).toBe(new URL(page.url()).protocol === "https:");
});

test("sign-up without JavaScript shows the server's refusal and keeps the name and email", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("No Script");
  // The browser accepts an address without a dot in the domain; the server does not.
  await page.getByLabel("Email", { exact: true }).fill("no-script@localhost");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "We couldn't create your account. Check your details and try again.",
  );
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("No Script");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("no-script@localhost");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});

test("a crafted sign-up post cannot set a password shorter than the minimum", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/sign-up");
  const tooShort = "p".repeat(PASSWORD_MIN_LENGTH - 1);
  const response = await postForm(page, formWith(page, "Password"), { name: "Crafted", email, password: tooShort });

  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(`Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`);

  await signIn(page, email, tooShort);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
});

test("sign-in without JavaScript refuses a wrong password with the neutral message", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email, "not-the-password-at-all");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
});

test("the 2FA code and recovery-code forms work without JavaScript and keep codes out of URLs", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  const { secret, uri, recoveryCodes } = await enrolTotpThroughApi(page);
  const totp = totpFromUri(uri);
  const [recoveryCode] = recoveryCodes;
  if (!recoveryCode) throw new Error("no recovery codes returned");

  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/two-factor$/);

  const wrongCode = wrongTotpCode(totp);
  await page.getByLabel("Authentication code").fill(wrongCode);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That code didn't work. Check your authenticator app and try again.",
  );

  const rightCode = totp.generate();
  await page.getByLabel("Authentication code").fill(rightCode);
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);

  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/two-factor$/);
  await page.getByRole("textbox", { name: "Recovery code" }).fill("not-a-recovery-code");
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That recovery code didn't work. Check it and try again.",
  );
  await page.getByRole("textbox", { name: "Recovery code" }).fill(recoveryCode);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);

  for (const secretValue of [secret, wrongCode, rightCode, recoveryCode]) {
    expect(requestedUrls.filter((url) => url.includes(secretValue))).toEqual([]);
  }
});

test("workspace creation works without JavaScript and the server refuses what the browser would block", async ({
  page,
  context,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  const workspaces = page.getByRole("list", { name: "Your workspaces" });

  await createWorkspace(page, "No Script Studio");
  await expect(workspaces).toContainText("No Script Studio");
  await expect(page.getByLabel("Active workspace").locator("option:checked")).toHaveText("No Script Studio");

  await createWorkspace(page, "   ");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Enter a workspace name.");

  const longest = "w".repeat(WORKSPACE_NAME_MAX_LENGTH);
  await createWorkspace(page, longest);
  await expect(workspaces).toContainText(longest);

  const tooLong = "x".repeat(WORKSPACE_NAME_MAX_LENGTH + 1);
  const refused = await postForm(page, formWith(page, "Workspace name"), { name: tooLong });
  expect(refused.status()).toBe(200);
  expect(await refused.text()).toContain(
    `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters for the workspace name.`,
  );

  // A post without a session is sent to sign in, and creates nothing.
  await page.goto("/workspaces");
  const cookies = await context.cookies();
  await context.clearCookies();
  const anonymous = await postForm(page, formWith(page, "Workspace name"), { name: "Anonymous Studio" });
  expect(anonymous.status()).toBe(303);
  expect(anonymous.headers().location).toMatch(/\/sign-in$/);

  await context.addCookies(cookies);
  await page.goto("/workspaces");
  await expect(workspaces.getByRole("listitem")).toHaveCount(2);
  await expect(workspaces).not.toContainText(tooLong);
  await expect(workspaces).not.toContainText("Anonymous Studio");
});

function formWithButton(page: Page, name: string): Locator {
  return page.locator("form").filter({ has: page.getByRole("button", { name, exact: true }) });
}

test("2FA enrolment works without JavaScript and keeps the password, secret and codes out of URLs", async ({
  page,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));

  await page.goto("/settings/security");
  await page.getByLabel("Current password").fill("not-the-password-at-all");
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Your password didn't match. Try again.");
  await expect(page.getByLabel("Current password")).toHaveValue("");

  await respectRateLimit(page);
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  const uri = (await page.getByTestId("totp-uri").textContent())?.trim() ?? "";
  const totp = totpFromUri(uri);
  const recoveryCodes = page.getByRole("list", { name: "recovery codes" }).getByRole("listitem");
  await expect(recoveryCodes).toHaveCount(10);
  const codes = await recoveryCodes.allTextContents();

  // A refused code renders the page again with the same setup key and recovery codes.
  const wrongCode = wrongTotpCode(totp);
  await page.getByLabel("Authentication code").fill(wrongCode);
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That code didn't work. Check your authenticator app and try again.",
  );
  await expect(page.getByTestId("totp-uri")).toHaveText(uri);
  await expect(recoveryCodes).toHaveText(codes);
  await expect(page.getByLabel("Authentication code")).toHaveValue("");

  await respectRateLimit(page);
  const rightCode = totp.generate();
  await page.getByLabel("Authentication code").fill(rightCode);
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");

  await signOut(page);
  await respectRateLimit(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/two-factor$/);

  const secret = new URL(uri).searchParams.get("secret") ?? "";
  for (const value of ["password=", encodeURIComponent(PASSWORD), secret, wrongCode, rightCode, ...codes]) {
    expect(requestedUrls.filter((url) => url.includes(value))).toEqual([]);
  }
});

test("a 2FA enrolment post without a session is sent to sign in", async ({ page, context }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await page.goto("/settings/security");
  await context.clearCookies();
  const anonymous = await postForm(page, formWith(page, "Current password"), { password: PASSWORD });
  expect(anonymous.status()).toBe(303);
  expect(anonymous.headers().location).toMatch(/\/sign-in$/);
});

test("the workspace switcher works without JavaScript and the server refuses a foreign or blank workspace", async ({
  page,
  context,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  await createWorkspace(page, "Alpha Studio");
  await createWorkspace(page, "Beta Studio");
  const switcher = page.getByLabel("Active workspace");
  await expect(switcher.locator("option:checked")).toHaveText("Beta Studio");

  await switcher.selectOption({ label: "Alpha Studio" });
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("listitem").filter({ hasText: "Alpha Studio" })).toContainText("(active)");
  await expect(switcher.locator("option:checked")).toHaveText("Alpha Studio");

  // By keyboard: type-ahead picks the workspace, then the Switch button submits it.
  await tabTo(page, switcher);
  await page.keyboard.press("b");
  await tabTo(page, page.getByRole("button", { name: "Switch", exact: true }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listitem").filter({ hasText: "Beta Studio" })).toContainText("(active)");

  // A blank id is refused before Better Auth is asked.
  const blank = await postForm(page, formWithButton(page, "Switch"), { organizationId: "" });
  expect(blank.status()).toBe(200);
  expect(await blank.text()).toContain("Couldn&#x27;t switch workspace. Try again.");
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Beta Studio" })).toContainText("(active)");

  // A nonblank id that is not a uuid never reaches Better Auth's uuid lookup.
  const malformed = await postForm(page, formWithButton(page, "Switch"), { organizationId: "not-a-uuid" });
  expect(malformed.status()).toBe(200);
  expect(await malformed.text()).toContain("Couldn&#x27;t switch workspace. Try again.");

  // A workspace the user does not belong to is refused, and Better Auth then clears the active
  // workspace (organization plugin 1.7.6); the page shows what the server has.
  await switcher.locator("option", { hasText: "Alpha Studio" }).evaluate((option: HTMLOptionElement, id) => {
    option.value = id;
  }, randomUUID());
  await switcher.selectOption({ label: "Alpha Studio" });
  await page.getByRole("button", { name: "Switch", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't switch workspace. Try again." })).toBeVisible();
  await expect(switcher.locator("option:checked")).toHaveText("Choose a workspace");
  await expect(page.getByRole("list", { name: "Your workspaces" })).not.toContainText("(active)");

  // A post without a session is sent to sign in, and switches nothing.
  const cookies = await context.cookies();
  await context.clearCookies();
  const anonymous = await postForm(page, formWithButton(page, "Switch"), {
    organizationId: (await switcher.locator("option", { hasText: "Beta Studio" }).getAttribute("value")) ?? "",
  });
  expect(anonymous.status()).toBe(303);
  expect(anonymous.headers().location).toMatch(/\/sign-in$/);
  await context.addCookies(cookies);
  await page.goto("/workspaces");
  await expect(page.getByRole("list", { name: "Your workspaces" })).not.toContainText("(active)");
});

test("sign-out works without JavaScript and ends the server session", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  await tabTo(page, page.getByRole("button", { name: "Sign out" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();

  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/sign-in$/);
});

// UNI-02: the server counts characters (code points); an emoji is two UTF-16 units, so a native
// maxlength would have cut these names at half the limit.
test("names of emoji at the limit arrive whole and one over is refused visibly, without JavaScript", async ({
  page,
}) => {
  const email = uniqueEmail();
  const userName = "😀".repeat(NAME_MAX_LENGTH);
  await signUp(page, email, PASSWORD, userName);

  const tooLongName = "😀".repeat(NAME_MAX_LENGTH + 1);
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill(tooLongName);
  await page.getByLabel("Email", { exact: true }).fill(uniqueEmail());
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(`Use at most ${NAME_MAX_LENGTH} characters for your name.`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(tooLongName);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);
  const workspaces = page.getByRole("list", { name: "Your workspaces" });
  const workspaceName = "😀".repeat(WORKSPACE_NAME_MAX_LENGTH);
  await createWorkspace(page, workspaceName);
  await expect(workspaces).toContainText(workspaceName);

  const tooLongWorkspace = "😀".repeat(WORKSPACE_NAME_MAX_LENGTH + 1);
  await createWorkspace(page, tooLongWorkspace);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters for the workspace name.`,
  );
  await expect(page.getByLabel("Workspace name")).toHaveValue(tooLongWorkspace);
  await expect(workspaces.getByRole("listitem")).toHaveCount(1);
});
