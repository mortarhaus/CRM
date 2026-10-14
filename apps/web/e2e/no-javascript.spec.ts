import { PASSWORD_MIN_LENGTH, WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { expect, test, type APIResponse, type Locator, type Page } from "@playwright/test";
import { totpFromUri, wrongTotpCode } from "../src/test/totp";
import { PASSWORD, respectRateLimit, signIn, signUp, uniqueEmail } from "./helpers";

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

test("the 2FA code and recovery-code forms work without JavaScript and keep codes out of URLs", async ({
  page,
  context,
}) => {
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

  // The sign-out button needs JavaScript (reported separately); a fresh sign-in starts from no cookies.
  await context.clearCookies();
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

  await context.clearCookies();
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
