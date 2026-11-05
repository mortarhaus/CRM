"use client";

import { accentVariants, BLACK, contrastRatio, THEME_SURFACES, type ThemeName } from "@crm/core/branding";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const THEMES: { theme: ThemeName; label: string; scheme: string }[] = [
  { theme: "light", label: "Light theme", scheme: "scheme-light" },
  { theme: "dark", label: "Dark theme", scheme: "scheme-dark" },
];

// Rounded down, so the page never states more contrast than there is.
const ratio = (a: string, b: string) => `${(Math.floor(contrastRatio(a, b) * 100) / 100).toFixed(2)}:1`;

function describe(colour: string, theme: ThemeName, label: string): string {
  const { accent, foreground } = accentVariants(colour)[theme];
  const [page, card] = THEME_SURFACES[theme];
  const moved = accent === colour ? "" : ` (${theme === "light" ? "darkened" : "lightened"} from ${colour} for contrast)`;
  const text = foreground === BLACK ? "black" : "white";
  return (
    `${label}: filled with ${accent}${moved}, with ${text} text. ` +
    `Contrast ${ratio(accent, page)} against the page and ${ratio(accent, card)} against cards.`
  );
}

// Both rendered variants of the colour (plan Task 6), each panel in its own color-scheme, so the light-dark() tokens
// of globals.css and of the brand token give that theme's surfaces and accent. Server-rendered, the panels show the
// stored colour through the layout's token; once hydrated, the colour being edited is set on the preview through the
// CSSOM, which the page CSP allows (an inline style attribute would be blocked).
export function BrandPreview({ colour }: { colour: string }) {
  const preview = useRef<HTMLElement>(null);

  useEffect(() => {
    const { light, dark } = accentVariants(colour);
    preview.current?.style.setProperty("--accent", `light-dark(${light.accent}, ${dark.accent})`);
    preview.current?.style.setProperty("--accent-foreground", `light-dark(${light.foreground}, ${dark.foreground})`);
  }, [colour]);

  return (
    <section ref={preview} aria-labelledby="brand-preview-heading" className="flex flex-col gap-3">
      <h2 id="brand-preview-heading" className="text-lg font-semibold">
        Preview
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {THEMES.map(({ theme, label, scheme }) => (
          <li key={theme}>
            <figure
              aria-describedby={`brand-preview-${theme}-description`}
              className={cn(scheme, "flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-4 text-foreground")}
            >
              <figcaption className="text-sm font-semibold">{label}</figcaption>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
                <span className="inline-flex min-h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground">
                  Button
                </span>
                <span className="inline-flex min-h-10 items-center rounded-md px-3 text-sm ring-2 ring-accent ring-offset-2 ring-offset-card">
                  Focus ring
                </span>
              </div>
              <p id={`brand-preview-${theme}-description`} className="text-sm text-muted-foreground">
                {describe(colour, theme, label)}
              </p>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
