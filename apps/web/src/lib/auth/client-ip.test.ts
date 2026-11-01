import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { CLIENT_IP_HEADER, deriveClientIp, PLACEHOLDER_CLIENT_IP, prepareAuthRequest } from "./client-ip";

// Plan Task 22 Step 1; spec "Rate limits" → "Client IP (one derivation for every path)".

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

const FALLBACK_LINE = JSON.stringify({ level: "warn", msg: "client ip fallback" });

function fallback() {
  return { ip: PLACEHOLDER_CLIENT_IP, fallback: true };
}

describe("deriveClientIp", () => {
  it("SaaS setting reads only CF-Connecting-IP and ignores X-Forwarded-For", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" });
    expect(deriveClientIp(headers, "cf-connecting-ip")).toEqual({ ip: "203.0.113.7", fallback: false });
    expect(deriveClientIp(new Headers({ "x-forwarded-for": "198.51.100.1" }), "cf-connecting-ip")).toEqual(fallback());
  });

  it("self-host setting reads only X-Forwarded-For and ignores CF-Connecting-IP", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1", "cf-connecting-ip": "203.0.113.7" });
    expect(deriveClientIp(headers, "x-forwarded-for")).toEqual({ ip: "198.51.100.1", fallback: false });
  });

  it("self-host setting refuses a two-address list", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" });
    expect(deriveClientIp(headers, "x-forwarded-for")).toEqual(fallback());
  });

  it("setting none always gives the placeholder", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1", "cf-connecting-ip": "203.0.113.7" });
    expect(deriveClientIp(headers, "none")).toEqual(fallback());
  });

  it.each(["", "   ", "not-an-ip", "203.0.113", "203.0.113.7:443", "999.1.1.1", "[2001:db8::1]"])(
    "a malformed value %j gives the placeholder",
    (value) => {
      expect(deriveClientIp(new Headers({ "cf-connecting-ip": value }), "cf-connecting-ip")).toEqual(fallback());
    },
  );

  it("a missing header gives the placeholder", () => {
    expect(deriveClientIp(new Headers(), "cf-connecting-ip")).toEqual(fallback());
  });

  it("logs each fallback as one warning line without the value (UNI-09)", () => {
    deriveClientIp(new Headers({ "cf-connecting-ip": "203.0.113.7, 198.51.100.1" }), "cf-connecting-ip");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(FALLBACK_LINE);
    deriveClientIp(new Headers({ "cf-connecting-ip": "203.0.113.7" }), "cf-connecting-ip");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keys an IPv6 address by its /64 prefix", () => {
    const one = deriveClientIp(new Headers({ "cf-connecting-ip": "2001:db8:1:2:3:4:5:6" }), "cf-connecting-ip");
    const two = deriveClientIp(new Headers({ "cf-connecting-ip": "2001:db8:1:2::9" }), "cf-connecting-ip");
    const other = deriveClientIp(new Headers({ "cf-connecting-ip": "2001:db8:1:3::9" }), "cf-connecting-ip");
    expect(one).toEqual({ ip: "2001:0db8:0001:0002:0000:0000:0000:0000", fallback: false });
    expect(two).toEqual(one);
    expect(other.ip).not.toBe(one.ip);
  });

  it("keys an IPv4-mapped IPv6 address as the IPv4 address", () => {
    expect(deriveClientIp(new Headers({ "cf-connecting-ip": "::ffff:203.0.113.7" }), "cf-connecting-ip")).toEqual({
      ip: "203.0.113.7",
      fallback: false,
    });
  });
});

describe("prepareAuthRequest", () => {
  function incoming(extra: Record<string, string>) {
    return new Request("https://crm.example.test/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=abc",
        origin: "https://crm.example.test",
        ...extra,
      },
      body: JSON.stringify({ email: "a@example.test", password: "secret phrase 123" }),
    });
  }

  it("overwrites a caller-supplied internal header and strips the four forwarding headers", async () => {
    const prepared = prepareAuthRequest(
      incoming({
        "cf-connecting-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.1",
        forwarded: "for=198.51.100.2",
        "x-real-ip": "198.51.100.3",
        [CLIENT_IP_HEADER]: "198.51.100.9",
      }),
      "cf-connecting-ip",
    );
    expect(prepared.headers.get(CLIENT_IP_HEADER)).toBe("203.0.113.7");
    for (const name of ["cf-connecting-ip", "x-forwarded-for", "forwarded", "x-real-ip"]) {
      expect(prepared.headers.has(name)).toBe(false);
    }
  });

  it("sets the placeholder when the trusted header is missing, never the forged internal header", () => {
    const prepared = prepareAuthRequest(incoming({ [CLIENT_IP_HEADER]: "198.51.100.9" }), "x-forwarded-for");
    expect(prepared.headers.get(CLIENT_IP_HEADER)).toBe(PLACEHOLDER_CLIENT_IP);
  });

  it("keeps the method, URL, body, cookies and origin", async () => {
    const prepared = prepareAuthRequest(incoming({ "x-forwarded-for": "198.51.100.1" }), "x-forwarded-for");
    expect(prepared.method).toBe("POST");
    expect(prepared.url).toBe("https://crm.example.test/api/auth/sign-in/email");
    expect(prepared.headers.get("cookie")).toBe("better-auth.session_token=abc");
    expect(prepared.headers.get("origin")).toBe("https://crm.example.test");
    expect(prepared.headers.get("content-type")).toBe("application/json");
    expect(await prepared.json()).toEqual({ email: "a@example.test", password: "secret phrase 123" });
  });
});
