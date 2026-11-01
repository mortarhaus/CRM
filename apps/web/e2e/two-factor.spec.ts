import { expect, test } from "./fixtures";
import { wrongTotpCode } from "../src/test/totp";
import {
  completeTotpSignIn,
  respectRateLimit,
  signIn,
  signOut,
  signUp,
  startTotpEnrolment,
  submitTotpCode,
  uniqueEmail,
} from "./helpers";

test("2FA: a wrong code is refused, the right code enrols, and sign-in then asks for a code", async ({ page }) => {
  await respectRateLimit(page);
  const email = uniqueEmail();
  await signUp(page, email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/workspaces$/);

  const totp = await startTotpEnrolment(page);
  await expect(page.getByRole("list", { name: "recovery codes" }).getByRole("listitem")).toHaveCount(10);

  await submitTotpCode(page, wrongTotpCode(totp));
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "That code didn't work. Check your authenticator app and try again.",
  );
  const afterWrongCode = await page.request.get("/api/auth/get-session");
  expect((await afterWrongCode.json()).user.twoFactorEnabled).toBe(false);

  await submitTotpCode(page, totp.generate());
  await expect(page.getByRole("status")).toHaveText("Two-factor authentication is on.");

  await signOut(page);
  await respectRateLimit(page);
  await signIn(page, email);
  await completeTotpSignIn(page, totp);
});
