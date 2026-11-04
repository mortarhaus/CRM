import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { isHttpsUrl, isLoopbackUrl } from "@/lib/origin";
import { parseTheme, returnPath, THEME_COOKIE, THEME_COOKIE_MAX_AGE_SECONDS } from "@/lib/theme";

// The theme form posts here as a plain HTML form, so it works without JavaScript (FE-32). Not a server action:
// action() needs an active workspace and a transaction, and this only sets a cookie on the caller's own browser.
export async function POST(request: NextRequest) {
  const { APP_URL } = getEnv();
  const appOrigin = new URL(APP_URL).origin;
  // A browser always sends Origin on a form POST; a missing or foreign one is a cross-site post.
  if (request.headers.get("origin") !== appOrigin) return new NextResponse(null, { status: 403 });
  if (!(await getCurrentSession())) return NextResponse.redirect(new URL("/sign-in", appOrigin), 303);

  // A body that is not form data is refused like an unknown theme.
  const form = await request.formData().catch(() => null);
  const theme = parseTheme(form?.get("theme"));
  if (!theme) return new NextResponse(null, { status: 400 });

  const response = NextResponse.redirect(new URL(returnPath(request.headers.get("referer"), appOrigin), appOrigin), 303);
  response.cookies.set(THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: "lax",
    // The session cookie's rule (lib/auth/config.ts): Secure on https and on every non-loopback origin (UNI-18).
    secure: isHttpsUrl(APP_URL) || !isLoopbackUrl(APP_URL),
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
