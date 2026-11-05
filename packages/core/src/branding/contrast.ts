import { hexToHsl, hexToRgb, hslToHex } from "./colour";

// WCAG 2.2 contrast for the workspace brand colour (plan Task 6; Q1 = A, confirmed by Charlie 2026-11-05). In Phase 2
// the accent is only a fill and a focus ring, never text, so it needs 3:1 against the surfaces it sits on (SC 1.4.11).
// The stored colour is never refused for contrast: each theme renders a variant moved just far enough to reach it.

export const BLACK = "#000000";
export const WHITE = "#ffffff";

// SC 1.4.11 non-text contrast.
export const NON_TEXT_CONTRAST = 3;

// The accent before a workspace sets one (Q5 = A, Charlie 2026-11-05). globals.css holds the same value.
export const DEFAULT_ACCENT = "#0e6c84";

// The page and card surfaces of each theme: globals.css --background and --card (apps/web/src/lib/brand.test.ts
// checks the two stay equal). Fixed, because every derived variant is computed against them (plan Task 1).
export const THEME_SURFACES = {
  light: ["#f4f7fb", "#ffffff"],
  dark: ["#080c10", "#0c1218"],
} as const satisfies Record<string, readonly [string, string]>;

export type ThemeName = keyof typeof THEME_SURFACES;

export function relativeLuminance(hex: string): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

// Text on the accent: black or white, whichever contrasts more (the better one always reaches at least 4.58:1).
export function pickForeground(hex: string): typeof BLACK | typeof WHITE {
  return contrastRatio(hex, BLACK) >= contrastRatio(hex, WHITE) ? BLACK : WHITE;
}

// The colour a theme renders for `hex`: unchanged when it reaches `min` against every surface; otherwise its HSL
// lightness moves one percent at a time away from the surfaces (darker on light surfaces, lighter on dark ones) until
// it does. Hue and saturation stay. Black on light and white on dark always pass, so the walk ends at the latest there.
export function deriveAccent(hex: string, surfaces: readonly string[], min = NON_TEXT_CONTRAST): string {
  const passes = (colour: string) => surfaces.every((surface) => contrastRatio(colour, surface) >= min);
  if (passes(hex)) return hex;
  const [first = WHITE] = surfaces;
  const darker = pickForeground(first) === BLACK;
  const { h, s, l } = hexToHsl(hex);
  for (let step = 1; step <= 100; step += 1) {
    const candidate = hslToHex({ h, s, l: Math.min(100, Math.max(0, darker ? l - step : l + step)) });
    if (passes(candidate)) return candidate;
  }
  return darker ? BLACK : WHITE;
}

export interface AccentVariant {
  accent: string;
  foreground: typeof BLACK | typeof WHITE;
}

export function accentVariants(hex: string): Record<ThemeName, AccentVariant> {
  const variant = (theme: ThemeName): AccentVariant => {
    const accent = deriveAccent(hex, THEME_SURFACES[theme]);
    return { accent, foreground: pickForeground(accent) };
  };
  return { light: variant("light"), dark: variant("dark") };
}
