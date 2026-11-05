import { describe, expect, it } from "vitest";
import { hexToHsl, hexToHsv, hslToHex, hsvToHex } from "./colour";
import {
  accentVariants,
  BLACK,
  contrastRatio,
  DEFAULT_ACCENT,
  deriveAccent,
  pickForeground,
  relativeLuminance,
  THEME_SURFACES,
  WHITE,
} from "./contrast";

// Plan Task 6 tests, against the real surface tokens (THEME_SURFACES; apps/web/src/lib/brand.test.ts checks they equal
// globals.css).
const [LIGHT_BACKGROUND, LIGHT_CARD] = THEME_SURFACES.light;
const [DARK_BACKGROUND, DARK_CARD] = THEME_SURFACES.dark;
const PALE = "#ffe066";
const DARK_NAVY = "#14213d";

const ratiosOn = (colour: string, surfaces: readonly string[]) => surfaces.map((surface) => contrastRatio(colour, surface));

describe("relativeLuminance and contrastRatio", () => {
  it("match the WCAG reference values", () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBe(1);
    expect(contrastRatio(BLACK, WHITE)).toBe(21);
    expect(contrastRatio(WHITE, BLACK)).toBe(21);
    expect(contrastRatio("#777777", WHITE)).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#767676", WHITE)).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#0000ff", WHITE)).toBeCloseTo(8.59, 2);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });

  it("refuses anything but a lower-case #rrggbb", () => {
    for (const value of ["#FFFFFF", "#fff", "fff000", "#fff;}body{color:red", ""]) {
      expect(() => relativeLuminance(value), value).toThrow(RangeError);
    }
  });
});

describe("pickForeground", () => {
  it("is black or white, whichever contrasts more, and always reaches 4.5:1", () => {
    expect(pickForeground(DEFAULT_ACCENT)).toBe(WHITE);
    expect(pickForeground(PALE)).toBe(BLACK);
    expect(pickForeground("#808080")).toBe(BLACK);
    for (const hex of [DEFAULT_ACCENT, PALE, DARK_NAVY, "#ff0000", "#00ff00", "#777777", "#000000", "#ffffff"]) {
      expect(contrastRatio(hex, pickForeground(hex)), hex).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("deriveAccent", () => {
  it("leaves the default accent unchanged in both themes (6.01/5.59 light, 3.27/3.14 dark)", () => {
    expect(deriveAccent(DEFAULT_ACCENT, THEME_SURFACES.light)).toBe(DEFAULT_ACCENT);
    expect(deriveAccent(DEFAULT_ACCENT, THEME_SURFACES.dark)).toBe(DEFAULT_ACCENT);
    expect(contrastRatio(DEFAULT_ACCENT, LIGHT_CARD)).toBeCloseTo(6.01, 2);
    expect(contrastRatio(DEFAULT_ACCENT, LIGHT_BACKGROUND)).toBeCloseTo(5.59, 2);
    expect(contrastRatio(DEFAULT_ACCENT, DARK_BACKGROUND)).toBeCloseTo(3.27, 2);
    expect(contrastRatio(DEFAULT_ACCENT, DARK_CARD)).toBeCloseTo(3.14, 2);
  });

  it("darkens a pale colour on the light theme until both surfaces reach 3:1, keeping its hue", () => {
    const derived = deriveAccent(PALE, THEME_SURFACES.light);
    expect(Math.min(...ratiosOn(PALE, THEME_SURFACES.light))).toBeLessThan(3);
    expect(Math.min(...ratiosOn(derived, THEME_SURFACES.light))).toBeGreaterThanOrEqual(3);
    expect(hexToHsl(derived).l).toBeLessThan(hexToHsl(PALE).l);
    expect(hexToHsl(derived).h).toBeCloseTo(hexToHsl(PALE).h, 0);
    // No further than needed: two percent lighter than the result fails again.
    const { h, s, l } = hexToHsl(derived);
    expect(Math.min(...ratiosOn(hslToHex({ h, s, l: l + 2 }), THEME_SURFACES.light))).toBeLessThan(3);
    // A pale colour already passes on the dark theme.
    expect(deriveAccent(PALE, THEME_SURFACES.dark)).toBe(PALE);
  });

  it("lightens a dark navy on the dark theme until both surfaces reach 3:1", () => {
    const derived = deriveAccent(DARK_NAVY, THEME_SURFACES.dark);
    expect(Math.min(...ratiosOn(DARK_NAVY, THEME_SURFACES.dark))).toBeLessThan(3);
    expect(Math.min(...ratiosOn(derived, THEME_SURFACES.dark))).toBeGreaterThanOrEqual(3);
    expect(hexToHsl(derived).l).toBeGreaterThan(hexToHsl(DARK_NAVY).l);
    expect(deriveAccent(DARK_NAVY, THEME_SURFACES.light)).toBe(DARK_NAVY);
  });

  it("reaches 3:1 on both surfaces of both themes for every colour, even the surfaces themselves", () => {
    const samples = [WHITE, BLACK, LIGHT_BACKGROUND, DARK_CARD, "#ffff00", "#00ffff", "#7f7f7f", "#1a0f00", "#ff00ff"];
    for (const hex of samples) {
      for (const surfaces of [THEME_SURFACES.light, THEME_SURFACES.dark]) {
        const derived = deriveAccent(hex, surfaces);
        expect(Math.min(...ratiosOn(derived, surfaces)), `${hex} on ${surfaces.join("/")}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("accentVariants", () => {
  it("gives each theme its derived accent with a black or white foreground", () => {
    expect(accentVariants(DEFAULT_ACCENT)).toEqual({
      light: { accent: DEFAULT_ACCENT, foreground: WHITE },
      dark: { accent: DEFAULT_ACCENT, foreground: WHITE },
    });
    const pale = accentVariants(PALE);
    expect(pale.dark).toEqual({ accent: PALE, foreground: BLACK });
    expect(pale.light.accent).toBe(deriveAccent(PALE, THEME_SURFACES.light));
    for (const { accent, foreground } of Object.values(accentVariants(DARK_NAVY))) {
      expect([BLACK, WHITE]).toContain(foreground);
      expect(foreground).toBe(pickForeground(accent));
    }
  });
});

describe("HSV for the drag picker", () => {
  it("round-trips a hex colour", () => {
    for (const hex of [DEFAULT_ACCENT, PALE, DARK_NAVY, BLACK, WHITE, "#ff0000", "#00ff80"]) {
      expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex);
    }
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 100, v: 100 });
    expect(hsvToHex({ h: 120, s: 100, v: 50 })).toBe("#008000");
  });
});
