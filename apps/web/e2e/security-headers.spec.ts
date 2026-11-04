import { expect, test } from "./fixtures";
import type { Page, Response } from "@playwright/test";
import { isHttpsUrl, isLoopbackUrl } from "../src/lib/origin";
import { buildCsp } from "../src/lib/security-headers";
import { enrolTotp, openShellMenu, respectRateLimit, signIn, signUp, uniqueEmail, workspaceSwitcher } from "./helpers";

// UNI-17 / UNI-18 (plan Task 25): the page CSP from src/proxy.ts, the API CSP and static headers from next.config.ts,
// and the session cookie's flags.

// `pnpm test:e2e` starts `pnpm dev` (the dev policy); with E2E_BASE_URL it runs against the image, a production build.
const DEV_SERVER = !process.env.E2E_BASE_URL;

declare global {
  interface Window {
    reportCspViolation?: (violation: string) => void;
  }
}

// Every document of the page reports to the test, before any page script runs (init scripts and exposed functions
// are not subject to the page's CSP). Console CSP errors are collected too.
async function recordCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction("reportCspViolation", (violation: string) => violations.push(violation));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      window.reportCspViolation?.(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /content security policy/i.test(message.text())) violations.push(message.text());
  });
  return violations;
}

function nonceOf(response: Response): string {
  const csp = response.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce, `no nonce in ${csp}`).toBeTruthy();
  return nonce ?? "";
}

// The nonce attribute is hidden from the DOM once parsed, so the served HTML is checked.
async function expectNoncedPage(response: Response | null): Promise<string> {
  expect(response).not.toBeNull();
  const page = response as Response;
  const nonce = nonceOf(page);
  expect(page.headers()["content-security-policy"]).toBe(buildCsp(nonce, DEV_SERVER));
  const scripts = (await page.text()).match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const tag of scripts) expect(tag, tag).toContain(`nonce="${nonce}"`);
  expect(page.headers()["strict-transport-security"]).toBe("max-age=31536000");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  return nonce;
}

async function createWorkspace(page: Page, name: string): Promise<void> {
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByRole("list", { name: "Your workspaces" })).toContainText(name);
}

test("/sign-in has a nonce CSP whose nonce changes per load and is on every script", async ({ page }) => {
  const first = await expectNoncedPage(await page.goto("/sign-in"));
  const second = await expectNoncedPage(await page.goto("/sign-in"));
  expect(second).not.toBe(first);
});

test("/api/health allows nothing and carries the static headers", async ({ request }) => {
  const response = await request.get("/api/health");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
});

test("no CSP violation through sign-in, 2FA enrolment and workspace switching; session cookie flags", async ({
  page,
  baseURL,
}) => {
  const violations = await recordCspViolations(page);
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  const first = await expectNoncedPage(await page.goto("/workspaces"));
  const second = await expectNoncedPage(await page.reload());
  expect(second).not.toBe(first);

  const session = (await page.context().cookies()).find((cookie) => cookie.name.endsWith("session_token"));
  expect(session, "no session cookie").toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  // Phase 0 sets Secure for https and every non-loopback origin (lib/auth/config.ts); local runs are loopback http.
  const origin = baseURL ?? "http://localhost:3000";
  expect(session?.secure).toBe(isHttpsUrl(origin) || !isLoopbackUrl(origin));

  await enrolTotp(page);
  await page.goto("/workspaces");
  await createWorkspace(page, "Headers Alpha");
  await createWorkspace(page, "Headers Beta");
  await openShellMenu(page);
  await workspaceSwitcher(page).selectOption({ label: "Headers Alpha" });
  await expect(page.getByRole("listitem").filter({ hasText: "Headers Alpha" })).toContainText("(active)");

  expect(violations).toEqual([]);
});
