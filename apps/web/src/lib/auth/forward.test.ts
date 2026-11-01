import { beforeEach, describe, expect, it, vi } from "vitest";

const { incoming, setCookie, handler, env } = vi.hoisted(() => ({
  incoming: new Headers(),
  setCookie: vi.fn(),
  handler: vi.fn<(request: Request) => Promise<Response>>(),
  env: { APP_URL: "https://crm.example.test", TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for" as string | undefined },
}));

vi.mock("next/headers", () => ({ headers: async () => incoming, cookies: async () => ({ set: setCookie }) }));
vi.mock("./server", () => ({ getAuth: () => ({ handler }) }));
vi.mock("../env", async (importOriginal) => ({ ...(await importOriginal<object>()), getEnv: () => env }));

const { postToAuth } = await import("./forward");

function json(status: number, body: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("postToAuth", () => {
  beforeEach(() => {
    for (const name of [...incoming.keys()]) incoming.delete(name);
    setCookie.mockClear();
    handler.mockReset();
    env.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
  });

  it("posts JSON to Better Auth's own handler with the headers its guards read and the derived client IP", async () => {
    incoming.set("cookie", "better-auth.session_token=abc");
    incoming.set("origin", "https://crm.example.test");
    incoming.set("x-forwarded-for", "203.0.113.7");
    incoming.set("sec-fetch-site", "same-origin");
    incoming.set("next-action", "action-id");
    incoming.set("content-type", "multipart/form-data; boundary=x");
    handler.mockResolvedValue(json(200, { ok: true }));

    await postToAuth("/sign-in/email", { email: "a@example.test", password: "secret phrase 123" });

    const [request] = handler.mock.calls[0] ?? [];
    expect(request?.url).toBe("https://crm.example.test/api/auth/sign-in/email");
    expect(request?.method).toBe("POST");
    expect(Object.fromEntries(request?.headers ?? [])).toEqual({
      "content-type": "application/json",
      cookie: "better-auth.session_token=abc",
      origin: "https://crm.example.test",
      "sec-fetch-site": "same-origin",
      "x-crm-client-ip": "203.0.113.7",
    });
    expect(await request?.json()).toEqual({ email: "a@example.test", password: "secret phrase 123" });
  });

  it("with the SaaS setting keys by CF-Connecting-IP and drops forged forwarding and internal headers", async () => {
    env.TRUSTED_CLIENT_IP_HEADER = "cf-connecting-ip";
    incoming.set("cf-connecting-ip", "203.0.113.8");
    incoming.set("x-forwarded-for", "198.51.100.1");
    incoming.set("forwarded", "for=198.51.100.2");
    incoming.set("x-real-ip", "198.51.100.3");
    incoming.set("x-crm-client-ip", "198.51.100.9");
    handler.mockResolvedValue(json(200, {}));

    await postToAuth("/sign-in/email", {});

    const [request] = handler.mock.calls[0] ?? [];
    expect(request?.headers.get("x-crm-client-ip")).toBe("203.0.113.8");
    for (const name of ["cf-connecting-ip", "x-forwarded-for", "forwarded", "x-real-ip"]) {
      expect(request?.headers.has(name)).toBe(false);
    }
  });

  it("with no trusted header configured gives the placeholder, not the caller's X-Forwarded-For", async () => {
    env.TRUSTED_CLIENT_IP_HEADER = undefined;
    incoming.set("x-forwarded-for", "203.0.113.7");
    handler.mockResolvedValue(json(200, {}));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await postToAuth("/sign-in/email", {});

    warn.mockRestore();
    const [request] = handler.mock.calls[0] ?? [];
    expect(request?.headers.get("x-crm-client-ip")).toBe("192.0.2.1");
  });

  it("puts every cookie Better Auth sets on the action's response with its flags", async () => {
    handler.mockResolvedValue(
      json(
        200,
        {},
        {
          "set-cookie":
            "__Secure-better-auth.session_token=abc.def; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax",
        },
      ),
    );

    await postToAuth("/sign-in/email", {});

    expect(setCookie).toHaveBeenCalledWith(
      "__Secure-better-auth.session_token",
      "abc.def",
      expect.objectContaining({ maxAge: 604800, path: "/", httpOnly: true, secure: true, sameSite: "lax" }),
    );
  });

  it.each([
    [429, null, undefined],
    [401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, "INVALID_EMAIL_OR_PASSWORD"],
  ])("passes a %i and its error code through", async (status, body, code) => {
    handler.mockResolvedValue(body ? json(status, body) : new Response(null, { status }));
    await expect(postToAuth("/sign-in/email", {})).resolves.toMatchObject({ ok: false, status, code });
    expect(setCookie).not.toHaveBeenCalled();
  });
});
