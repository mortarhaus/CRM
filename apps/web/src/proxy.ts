import { type NextRequest, NextResponse } from "next/server";
import { buildCsp } from "@/lib/security-headers";

// A fresh nonce and page CSP per request (Next 16 CSP guide). Next reads the nonce from the request's CSP header and
// puts it on its own scripts. No database here (AUTH-11); authorization stays in the server actions (AUTH-02).
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Pages only: /api gets its own policy from next.config.ts, static files need none, and prefetches are skipped (docs).
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
