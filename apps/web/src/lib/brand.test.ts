import { readFileSync } from "node:fs";
import { DEFAULT_ACCENT, THEME_SURFACES } from "@crm/core/branding";
import { describe, expect, it } from "vitest";
import { brandTokenCss } from "./brand";

const GLOBALS_CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

// The value of a token on :root in globals.css, e.g. "light-dark(#f4f7fb, #080c10)".
function token(name: string): string | undefined {
  return new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m").exec(GLOBALS_CSS)?.[1]?.trim();
}

describe("brandTokenCss", () => {
  it("renders each theme's derived accent and foreground", () => {
    expect(brandTokenCss("#0e6c84")).toBe(
      ":root{--accent:light-dark(#0e6c84,#0e6c84);--accent-foreground:light-dark(#ffffff,#ffffff)}",
    );
    expect(brandTokenCss("#ffe066")).toBe(
      ":root{--accent:light-dark(#ad8a00,#ffe066);--accent-foreground:light-dark(#000000,#000000)}",
    );
  });

  // Plan Task 6: a malicious value never reaches the <style>, even if it got past Zod and the CHECK.
  it.each(["#fff;}body{display:none}", "#ffffff;}body{x:y", "#FFFFFF", "#fff", "#0e6c84 ", "red", "", null, undefined, 0])(
    "renders nothing for %j, so the default accent applies",
    (stored) => {
      expect(brandTokenCss(stored)).toBeNull();
    },
  );
});

// The contrast maths (packages/core/src/branding) is computed against these values; globals.css must hold the same.
describe("globals.css tokens match @crm/core/branding", () => {
  it("has the light and dark --background and --card surfaces", () => {
    expect(token("background")).toBe(`light-dark(${THEME_SURFACES.light[0]}, ${THEME_SURFACES.dark[0]})`);
    expect(token("card")).toBe(`light-dark(${THEME_SURFACES.light[1]}, ${THEME_SURFACES.dark[1]})`);
  });

  it("has the default accent", () => {
    expect(token("accent")).toBe(DEFAULT_ACCENT);
  });
});
