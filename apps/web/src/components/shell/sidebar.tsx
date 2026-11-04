import { Building2, Mail, ShieldCheck } from "lucide-react";
import { NavItem } from "./nav-item";

const ICON = "size-5";

// Each destination keeps a visible name under its icon, so no hover-only tooltip is needed (WCAG 1.4.13). Below md the
// bar is a strip in the page flow, not a fixed bottom bar, which covered form buttons at 320px (WCAG 2.4.11).
// Email settings are Admin and Owner only (AUTH-03); the page and its action check the role themselves.
export function Sidebar({ showEmailSettings }: { showEmailSettings: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="border-b border-border bg-card md:sticky md:top-0 md:h-dvh md:shrink-0 md:border-b-0 md:border-r"
    >
      <ul className="flex justify-around gap-1 p-2 md:flex-col md:justify-start md:gap-2 md:p-3 md:pt-6">
        <li>
          <NavItem href="/workspaces" label="Workspaces" icon={<Building2 aria-hidden className={ICON} />} />
        </li>
        <li>
          <NavItem href="/settings/security" label="Security" icon={<ShieldCheck aria-hidden className={ICON} />} />
        </li>
        {showEmailSettings && (
          <li>
            <NavItem href="/settings/email" label="Email" icon={<Mail aria-hidden className={ICON} />} />
          </li>
        )}
      </ul>
    </nav>
  );
}
