import { Building2, Mail, ShieldCheck } from "lucide-react";
import { NavItem, type NavItemProps } from "./nav-item";

const ICON = "size-5";

interface NavLinksProps {
  showEmailSettings: boolean;
  layout: NavItemProps["layout"];
  className?: string;
}

// The destinations that exist today, shared by the rail, the phone tab bar and the menu drawer (UNI-05: nothing
// from a later phase). Email settings are Admin and Owner only (AUTH-03); the page and its action check the role.
export function NavLinks({ showEmailSettings, layout, className }: NavLinksProps) {
  return (
    <ul className={className}>
      <li>
        <NavItem href="/workspaces" label="Workspaces" layout={layout} icon={<Building2 aria-hidden className={ICON} />} />
      </li>
      <li>
        <NavItem
          href="/settings/security"
          label="Security"
          layout={layout}
          icon={<ShieldCheck aria-hidden className={ICON} />}
        />
      </li>
      {showEmailSettings && (
        <li>
          <NavItem href="/settings/email" label="Email" layout={layout} icon={<Mail aria-hidden className={ICON} />} />
        </li>
      )}
    </ul>
  );
}
