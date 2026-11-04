import { NavLinks } from "./nav-links";

// The slim icon rail from md up. Each destination keeps a visible name under its icon, so no hover-only tooltip is
// needed (WCAG 1.4.13). Below md the tab bar and the menu drawer take its place (bottom-bar.tsx, menu-drawer.tsx).
export function Sidebar({ showEmailSettings }: { showEmailSettings: boolean }) {
  return (
    <nav aria-label="Main" className="hidden border-r border-border bg-card md:sticky md:top-0 md:block md:h-dvh md:shrink-0">
      <NavLinks showEmailSettings={showEmailSettings} layout="stacked" className="flex flex-col gap-2 p-3 pt-6" />
    </nav>
  );
}
