// Security headers (spec UNI-17, UNI-18; plan Task 25). Where each one is applied is in docs/DECISIONS.md: the page
// CSP by src/proxy.ts (a nonce per request), everything else by next.config.ts headers().

export interface SecurityHeader {
  key: string;
  value: string;
}

// The page policy from the Next 16 CSP guide, plus connect-src. In dev React needs eval for its debugging tooling,
// and dev styles are injected inline without a nonce; a nonce in style-src would make browsers ignore 'unsafe-inline'.
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// HSTS: one year, no includeSubDomains, no preload (Charlie, ASK 6 option A): other subdomains of the domain stay free
// to serve plain HTTP, and nothing is submitted to the browsers' preload lists.
export const STATIC_SECURITY_HEADERS: SecurityHeader[] = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// For responses that are not HTML. Never on a page: a browser enforces every policy it receives, so this one beside
// the nonce policy would block every script and style.
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

// next.config.ts headers(). The proxy's matcher skips /api, so /api responses carry only API_CSP.
export const SECURITY_HEADER_ROUTES: { source: string; headers: SecurityHeader[] }[] = [
  { source: "/(.*)", headers: STATIC_SECURITY_HEADERS },
  { source: "/api/(.*)", headers: [{ key: "Content-Security-Policy", value: API_CSP }] },
];
