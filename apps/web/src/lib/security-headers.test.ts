import { describe, expect, it } from "vitest";
import { API_CSP, buildCsp, SECURITY_HEADER_ROUTES, STATIC_SECURITY_HEADERS } from "./security-headers";

const NONCE = "bm9uY2Utbm9uY2Utbm9uY2U=";

describe("buildCsp", () => {
  it("gives the production page policy in the plan's order, with the nonce and no 'unsafe-inline'", () => {
    const csp = buildCsp(NONCE, false);
    expect(csp).toBe(
      `default-src 'self'; script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'; style-src 'self' 'nonce-${NONCE}'; ` +
        "img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; " +
        "form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
    );
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("in dev adds 'unsafe-eval' to script-src and uses 'unsafe-inline' with no nonce for style-src", () => {
    const csp = buildCsp(NONCE, true);
    const directives = csp.split("; ");
    expect(directives).toContain(`script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-eval'`);
    // A nonce in the same directive would make browsers ignore 'unsafe-inline'.
    expect(directives).toContain("style-src 'self' 'unsafe-inline'");
    expect(directives.filter((d) => !d.startsWith("script-src") && !d.startsWith("style-src"))).toEqual(
      buildCsp(NONCE, false)
        .split("; ")
        .filter((d) => !d.startsWith("script-src") && !d.startsWith("style-src")),
    );
  });
});

describe("static security headers", () => {
  const byKey = new Map(STATIC_SECURITY_HEADERS.map(({ key, value }) => [key, value]));

  it("sets HSTS for one year, without includeSubDomains or preload (ASK 6, option A)", () => {
    expect(byKey.get("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("sets nosniff, the referrer policy and the permissions policy", () => {
    expect(STATIC_SECURITY_HEADERS).toEqual([
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]);
  });

  it("carries no CSP: a second policy on a page would be enforced alongside the nonce one", () => {
    expect(byKey.has("Content-Security-Policy")).toBe(false);
  });

  it("gives non-HTML responses a policy that allows nothing", () => {
    expect(API_CSP).toBe("default-src 'none'; frame-ancestors 'none'");
  });

  it("applies the static headers everywhere and the non-HTML CSP to /api only", () => {
    expect(SECURITY_HEADER_ROUTES).toEqual([
      { source: "/(.*)", headers: STATIC_SECURITY_HEADERS },
      { source: "/api/(.*)", headers: [{ key: "Content-Security-Policy", value: API_CSP }] },
    ]);
  });
});
