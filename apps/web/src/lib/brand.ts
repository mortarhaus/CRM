import { accentVariants, isHexColour } from "@crm/core/branding";

// The workspace brand token (plan Task 6): the text of the nonce'd <style> the app layout renders, overriding the
// default --accent of globals.css. Built only from the stored value, and only after checking it again against
// ^#[0-9a-f]{6}$ (defence in depth: the action's Zod and the column's CHECK refuse the same set). Anything else,
// unset included, renders nothing and the default applies. light-dark() picks each theme's derived variant by the
// element's color-scheme, as every token in globals.css does, so the branding preview can show both themes at once.
export function brandTokenCss(stored: unknown): string | null {
  if (!isHexColour(stored)) return null;
  const { light, dark } = accentVariants(stored);
  return (
    `:root{--accent:light-dark(${light.accent},${dark.accent});` +
    `--accent-foreground:light-dark(${light.foreground},${dark.foreground})}`
  );
}
