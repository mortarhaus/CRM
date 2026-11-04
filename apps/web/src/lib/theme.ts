import { cookies } from "next/headers";

// Dark mode is a per-browser cookie, read server-side so the first paint is already themed (plan Q3, Task 3).
export const THEME_COOKIE = "crm_theme";
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

// A display preference, not a business value: kept for a year, then the system setting applies again.
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseTheme(value: unknown): Theme | null {
  return THEMES.find((theme) => theme === value) ?? null;
}

// The class on <html>; "system" has none, so globals.css follows prefers-color-scheme.
export function themeClass(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

// Where the theme form returns to: the page it was posted from, only when that page is on the app's own origin.
export function returnPath(referer: string | null, appOrigin: string): string {
  if (!referer || !URL.canParse(referer)) return "/";
  const url = new URL(referer);
  // A path starting "//" would be read as another host when the redirect URL is built from it.
  if (url.origin !== appOrigin || url.pathname.startsWith("//")) return "/";
  return `${url.pathname}${url.search}`;
}

export async function currentTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value) ?? "system";
}
