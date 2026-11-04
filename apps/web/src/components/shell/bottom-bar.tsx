import { NavLinks } from "./nav-links";

// Below md: a floating tab bar inset from the screen edges (the Kinlo sample's phone layout, Charlie 2026-11-04).
// It is fixed, so the layout gives <main> bottom padding taller than the bar and globals.css a matching
// scroll-padding, which keeps a focused control above it (WCAG 2.2 SC 2.4.11).
export function BottomBar({ showEmailSettings }: { showEmailSettings: boolean }) {
  return (
    <nav
      aria-label="Quick"
      className="fixed inset-x-2.5 bottom-2.5 z-30 rounded-2xl border border-border bg-card p-1.5 shadow-lg md:hidden"
    >
      <NavLinks
        showEmailSettings={showEmailSettings}
        layout="stacked"
        className="grid auto-cols-fr grid-flow-col gap-1"
      />
    </nav>
  );
}
