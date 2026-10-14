import { PASSWORD_MIN_LENGTH, WORKSPACE_NAME_MAX_LENGTH } from "@crm/core/security";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "@/lib/auth/forward";
import { EMPTY_FORM_STATE } from "@/lib/forms";

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Redirect(url);
  }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/auth/forward", () => ({ postToAuth: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentSession: vi.fn() }));

const { refresh } = await import("next/cache");
const { postToAuth } = await import("@/lib/auth/forward");
const { getCurrentSession } = await import("@/lib/auth/session");
const { signUpAction } = await import("./(auth)/sign-up/actions");
const { signInAction } = await import("./(auth)/sign-in/actions");
const { verifyTwoFactorAction } = await import("./(auth)/two-factor/actions");
const { createWorkspaceAction } = await import("./(app)/workspaces/actions");

function answer(status: number, data: unknown = null): AuthResult {
  const code = typeof data === "object" && data !== null && "code" in data ? String(data.code) : undefined;
  return { ok: status >= 200 && status < 300, status, code, data };
}

function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

beforeEach(() => {
  vi.mocked(postToAuth).mockReset();
  vi.mocked(refresh).mockClear();
  vi.mocked(getCurrentSession).mockReset();
});

describe("signUpAction", () => {
  const fields = { name: "Owner", email: "owner@example.test", password: "a long enough passphrase" };

  it("sends the user to sign in after Better Auth answers, new email or not", async () => {
    vi.mocked(postToAuth).mockResolvedValue(answer(200, { token: null }));
    await expect(signUpAction(EMPTY_FORM_STATE, formData(fields))).rejects.toEqual(new Redirect("/sign-in?registered=1"));
    expect(postToAuth).toHaveBeenCalledWith("/sign-up/email", fields);
  });

  it.each([
    [answer(429), "Too many attempts. Wait a moment and try again."],
    [answer(400, { code: "PASSWORD_TOO_SHORT" }), `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`],
    [answer(400, { code: "VALIDATION_ERROR" }), "We couldn't create your account. Check your details and try again."],
  ])("shows a refusal and keeps the name and email, never the password (%#)", async (result, error) => {
    vi.mocked(postToAuth).mockResolvedValue(result);
    await expect(signUpAction(EMPTY_FORM_STATE, formData(fields))).resolves.toEqual({
      error,
      fields: { name: "Owner", email: "owner@example.test" },
    });
  });
});

describe("signInAction", () => {
  const fields = { email: "owner@example.test", password: "a long enough passphrase" };

  it.each([
    [{ redirect: false, token: "t" }, "/workspaces"],
    [{ twoFactorRedirect: true }, "/two-factor"],
  ])("redirects after a successful sign-in (%#)", async (data, url) => {
    vi.mocked(postToAuth).mockResolvedValue(answer(200, data));
    await expect(signInAction(EMPTY_FORM_STATE, formData(fields))).rejects.toEqual(new Redirect(url));
  });

  it.each([
    [answer(401, { code: "INVALID_EMAIL_OR_PASSWORD" }), "Email or password is incorrect."],
    [answer(400, { code: "PASSWORD_TOO_LONG" }), "Email or password is incorrect."],
    [answer(403, { code: "INVALID_ORIGIN" }), "Email or password is incorrect."],
    [answer(429), "Too many attempts. Wait a moment and try again."],
  ])("answers every refusal with the one neutral message (%#)", async (result, error) => {
    vi.mocked(postToAuth).mockResolvedValue(result);
    await expect(signInAction(EMPTY_FORM_STATE, formData(fields))).resolves.toEqual({
      error,
      fields: { email: "owner@example.test" },
    });
  });
});

describe("verifyTwoFactorAction", () => {
  it("verifies an authenticator code without trusting the device, then opens the workspaces", async () => {
    vi.mocked(postToAuth).mockResolvedValue(answer(200, {}));
    await expect(
      verifyTwoFactorAction(EMPTY_FORM_STATE, formData({ method: "totp", code: " 123456 " })),
    ).rejects.toEqual(new Redirect("/workspaces"));
    expect(postToAuth).toHaveBeenCalledWith("/two-factor/verify-totp", { code: "123456", trustDevice: false });
  });

  it("verifies a recovery code through its own endpoint", async () => {
    vi.mocked(postToAuth).mockResolvedValue(answer(200, {}));
    await expect(
      verifyTwoFactorAction(EMPTY_FORM_STATE, formData({ method: "recovery", code: "abcde-12345" })),
    ).rejects.toEqual(new Redirect("/workspaces"));
    expect(postToAuth).toHaveBeenCalledWith("/two-factor/verify-backup-code", { code: "abcde-12345" });
  });

  it.each([
    ["totp", answer(401), "That code didn't work. Check your authenticator app and try again."],
    ["recovery", answer(401), "That recovery code didn't work. Check it and try again."],
    ["totp", answer(429), "Too many attempts. Wait a moment and try again."],
  ])("shows the %s refusal", async (method, result, error) => {
    vi.mocked(postToAuth).mockResolvedValue(result);
    await expect(verifyTwoFactorAction(EMPTY_FORM_STATE, formData({ method, code: "000000" }))).resolves.toEqual({
      error,
      fields: {},
    });
  });

  it("refuses an unknown method without calling Better Auth", async () => {
    await expect(
      verifyTwoFactorAction(EMPTY_FORM_STATE, formData({ method: "sms", code: "000000" })),
    ).resolves.toMatchObject({ error: "That code didn't work. Check your authenticator app and try again." });
    expect(postToAuth).not.toHaveBeenCalled();
  });
});

describe("createWorkspaceAction", () => {
  it("sends a visitor without a session to sign in and creates nothing", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    await expect(createWorkspaceAction(EMPTY_FORM_STATE, formData({ name: "Studio" }))).rejects.toEqual(
      new Redirect("/sign-in"),
    );
    expect(postToAuth).not.toHaveBeenCalled();
  });

  describe("with a session", () => {
    beforeEach(() => {
      vi.mocked(getCurrentSession).mockResolvedValue({} as Awaited<ReturnType<typeof getCurrentSession>>);
    });

    it("refuses a blank name without calling Better Auth", async () => {
      await expect(createWorkspaceAction(EMPTY_FORM_STATE, formData({ name: "   " }))).resolves.toEqual({
        error: "Enter a workspace name.",
        fields: { name: "" },
      });
      expect(postToAuth).not.toHaveBeenCalled();
    });

    it("creates the trimmed name with a unique slug and refreshes the page", async () => {
      vi.mocked(postToAuth).mockResolvedValue(answer(200, { id: "w1" }));
      await expect(createWorkspaceAction(EMPTY_FORM_STATE, formData({ name: "  Studio Alpha " }))).resolves.toEqual(
        EMPTY_FORM_STATE,
      );
      expect(postToAuth).toHaveBeenCalledWith("/organization/create", {
        name: "Studio Alpha",
        slug: expect.stringMatching(/^studio-alpha-[0-9a-f]{8}$/),
      });
      expect(refresh).toHaveBeenCalledOnce();
    });

    it.each([
      [
        answer(400, { code: "WORKSPACE_NAME_TOO_LONG" }),
        `Use at most ${WORKSPACE_NAME_MAX_LENGTH} characters for the workspace name.`,
      ],
      [answer(500), "We couldn't create that workspace. Try again."],
    ])("shows the server's refusal and keeps the name (%#)", async (result, error) => {
      vi.mocked(postToAuth).mockResolvedValue(result);
      await expect(createWorkspaceAction(EMPTY_FORM_STATE, formData({ name: "Studio" }))).resolves.toEqual({
        error,
        fields: { name: "Studio" },
      });
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
