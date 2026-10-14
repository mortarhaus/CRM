import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

// Every WCAG 2.0-2.2 A and AA tag axe-core 4.13.0 has (it has no `wcag22a` tag). `color-contrast`
// is tagged `wcag2aa`, so it runs in every scan.
const WCAG_A_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// globals.css defines dark tokens under `prefers-color-scheme: dark`, so both schemes are scanned.
const COLOR_SCHEMES = ["light", "dark"] as const;

async function expectNoHorizontalOverflow(page: Page, state: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${state}: page is wider than the viewport`).toBeLessThanOrEqual(0);
}

export async function expectAccessible(page: Page, state: string): Promise<void> {
  await expectNoHorizontalOverflow(page, state);
  for (const colorScheme of COLOR_SCHEMES) {
    await page.emulateMedia({ colorScheme });
    // Buttons use transition-colors; scan the settled colours, not a frame mid-transition.
    await page.evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter((animation) => animation instanceof CSSTransition)
          .map((animation) => animation.finished),
      ),
    );
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_A_AA_TAGS).analyze();
    const summary = violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((n) => n.target) }));
    expect(summary, `${state} (${colorScheme})`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: null });
}

export async function expectVisibleFocus(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const indicator = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  const hasRing = indicator.boxShadow !== "none";
  const hasOutline = indicator.outlineStyle !== "none" && indicator.outlineWidth !== "0px";
  expect(hasRing || hasOutline, `no visible focus indicator: ${JSON.stringify(indicator)}`).toBe(true);
}

const MAX_TABS = 25;

// Presses Tab until `target` has focus, checking that every control passed on the way shows focus.
export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < MAX_TABS; presses += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expectVisibleFocus(target);
      return;
    }
    // `next dev` adds its dev-tools button to the tab order; production builds have no such element.
    const onDevTools = await page.evaluate(() => document.activeElement?.tagName === "NEXTJS-PORTAL");
    if (!onDevTools) await expectVisibleFocus(page.locator(":focus"));
  }
  throw new Error(`not reachable with ${MAX_TABS} Tab presses: ${target.toString()}`);
}
