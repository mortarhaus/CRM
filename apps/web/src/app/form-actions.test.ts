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
  RedirectType: { push: "push", replace: "replace" },
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
const { setActiveWorkspaceAction, signOutAction } = await import("./(app)/actions");
const { startTwoFactorAction, confirmTwoFactorAction } = await import("./(app)/settings/security/actions");

const WORKSPACE_ID = "0c3f6f6e-3b59-4f0e-8a2d-6f1b7a9c4d10";

function answer(status: number, data: unknown = null): AuthResult {
  const code = typeof data === "object" && data !== null && "code" in data ? String(data.code) : undefined;
  return { ok: status >= 200 && status < 300, status, code, data };
}

function formData(fields: Record<string, string | string[]>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of [value].flat()) form.append(name, item);
  }
  return form;
}

function withSession(): void {
  vi.mocked(getCurrentSession).mockResolvedValue({} as Awaited<ReturnType<typeof getCurrentSession>>);
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
    beforeEach(withSession);

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

describe("setActiveWorkspaceAction", () => {
  it("sends a visitor without a session to sign in and switches nothing", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    await expect(setActiveWorkspaceAction(EMPTY_FORM_STATE, formData({ organizationId: WORKSPACE_ID }))).rejects.toEqual(
      new Redirect("/sign-in"),
    );
    expect(postToAuth).not.toHaveBeenCalled();
  });

  describe("with a session", () => {
    beforeEach(withSession);

    it.each<Record<string, string>>([
      {},
      { organizationId: "" },
      { organizationId: "   " },
      { organizationId: "not-a-uuid" },
      { organizationId: `${WORKSPACE_ID} ` },
      { organizationId: `${WORKSPACE_ID}0` },
      { organizationId: "{" + WORKSPACE_ID + "}" },
    ])(
      "refuses a missing, blank or malformed workspace id without calling Better Auth (%#)",
      async (fields) => {
        await expect(setActiveWorkspaceAction(EMPTY_FORM_STATE, formData(fields))).resolves.toEqual({
          error: "Couldn't switch workspace. Try again.",
          fields: {},
        });
        expect(postToAuth).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
      },
    );

    it("switches the workspace and refreshes the page", async () => {
      vi.mocked(postToAuth).mockResolvedValue(answer(200, { id: "w1" }));
      await expect(setActiveWorkspaceAction(EMPTY_FORM_STATE, formData({ organizationId: WORKSPACE_ID }))).resolves.toEqual(
        EMPTY_FORM_STATE,
      );
      expect(postToAuth).toHaveBeenCalledWith("/organization/set-active", { organizationId: WORKSPACE_ID });
      expect(refresh).toHaveBeenCalledOnce();
    });

    it.each([
      [answer(403, { code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION" }), "Couldn't switch workspace. Try again."],
      [answer(500), "Couldn't switch workspace. Try again."],
      [answer(429), "Too many attempts. Wait a moment and try again."],
    ])("shows the refusal and refreshes, as Better Auth may have cleared the workspace (%#)", async (result, error) => {
      vi.mocked(postToAuth).mockResolvedValue(result);
      await expect(
        setActiveWorkspaceAction(EMPTY_FORM_STATE, formData({ organizationId: "5f0c1a52-6c1e-4b8e-9a52-0d0f2f4b7a11" })),
      ).resolves.toEqual({ error, fields: {} });
      expect(refresh).toHaveBeenCalledOnce();
    });
  });
});

describe("signOutAction", () => {
  it("sends a visitor without a session to sign in without calling Better Auth", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    await expect(signOutAction()).rejects.toEqual(new Redirect("/sign-in"));
    expect(postToAuth).not.toHaveBeenCalled();
  });

  describe("with a session", () => {
    beforeEach(withSession);

    it("goes to sign in once Better Auth confirms the sign-out", async () => {
      vi.mocked(postToAuth).mockResolvedValue(answer(200, { success: true }));
      await expect(signOutAction()).rejects.toEqual(new Redirect("/sign-in"));
      expect(postToAuth).toHaveBeenCalledWith("/sign-out", {});
    });

    it.each([answer(500), answer(403, { code: "INVALID_ORIGIN" })])(
      "stays on the page with the retry message when the sign-out fails (%#)",
      async (result) => {
        vi.mocked(postToAuth).mockResolvedValue(result);
        await expect(signOutAction()).resolves.toEqual({
          error: "We couldn't sign you out. Try again.",
          fields: {},
        });
      },
    );
  });
});

describe("2FA enrolment actions", () => {
  const EMPTY_SETUP_STATE = { error: null, fields: {}, enrolment: null };
  const totpURI = "otpauth://totp/CRM:owner%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=CRM";
  const backupCodes = ["aaaaa-11111", "bbbbb-22222"];
  const enrolment = { totpURI, setupKey: "JBSWY3DPEHPK3PXP", backupCodes };

  it("sends a visitor without a session to sign in before starting or confirming", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    await expect(startTwoFactorAction(EMPTY_SETUP_STATE, formData({ password: "pw" }))).rejects.toEqual(
      new Redirect("/sign-in"),
    );
    await expect(confirmTwoFactorAction(EMPTY_SETUP_STATE, formData({ code: "123456" }))).rejects.toEqual(
      new Redirect("/sign-in"),
    );
    expect(postToAuth).not.toHaveBeenCalled();
  });

  describe("with a session", () => {
    beforeEach(withSession);

    it("starts enrolment with the password and returns the setup key and recovery codes", async () => {
      vi.mocked(postToAuth).mockResolvedValue(answer(200, { totpURI, backupCodes }));
      await expect(startTwoFactorAction(EMPTY_SETUP_STATE, formData({ password: "the password" }))).resolves.toEqual({
        error: null,
        fields: {},
        enrolment,
      });
      expect(postToAuth).toHaveBeenCalledWith("/two-factor/enable", { password: "the password" });
    });

    it.each([
      [answer(400, { code: "INVALID_PASSWORD" }), "Your password didn't match. Try again."],
      [answer(200, { totpURI: "https://example.test/", backupCodes }), "Your password didn't match. Try again."],
      [answer(429), "Too many attempts. Wait a moment and try again."],
    ])("refuses a wrong password or a bad answer and never keeps the password (%#)", async (result, error) => {
      vi.mocked(postToAuth).mockResolvedValue(result);
      await expect(startTwoFactorAction(EMPTY_SETUP_STATE, formData({ password: "wrong" }))).resolves.toEqual({
        error,
        fields: {},
        enrolment: null,
      });
    });

    it("confirms the trimmed code and reloads the security page", async () => {
      vi.mocked(postToAuth).mockResolvedValue(answer(200, {}));
      await expect(
        confirmTwoFactorAction(EMPTY_SETUP_STATE, formData({ code: " 123456 ", totpURI, backupCode: backupCodes })),
      ).rejects.toEqual(new Redirect("/settings/security"));
      expect(postToAuth).toHaveBeenCalledWith("/two-factor/verify-totp", { code: "123456" });
    });

    it.each([
      [answer(401), "That code didn't work. Check your authenticator app and try again."],
      [answer(429), "Too many attempts. Wait a moment and try again."],
    ])("refuses a wrong code and shows the enrolment again (%#)", async (result, error) => {
      vi.mocked(postToAuth).mockResolvedValue(result);
      await expect(
        confirmTwoFactorAction(EMPTY_SETUP_STATE, formData({ code: "000000", totpURI, backupCode: backupCodes })),
      ).resolves.toEqual({ error, fields: {}, enrolment });
    });

    it("does not echo a setup link that is not an authenticator link", async () => {
      vi.mocked(postToAuth).mockResolvedValue(answer(401));
      await expect(
        confirmTwoFactorAction(
          EMPTY_SETUP_STATE,
          formData({ code: "000000", totpURI: "javascript:alert(1)", backupCode: backupCodes }),
        ),
      ).resolves.toMatchObject({ enrolment: null });
    });
  });
});
