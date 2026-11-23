import { Building2, Landmark, Mail, Palette, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { NavItem, type NavItemProps } from "./nav-item";

const ICON = "size-5";

interface NavLinksProps {
  showAdminSettings: boolean;
  // Bank details: Owner only (spec line 798).
  showOwnerSettings?: boolean;
  layout: NavItemProps["layout"];
  // The phone tab bar: four 4.5rem items do not fit at 320px, so General and Branding are reached through the menu
  // drawer there.
  quick?: boolean;
  className?: string;
}

// The destinations that exist today, shared by the rail, the phone tab bar and the menu drawer (UNI-05: nothing
// from a later phase). Email, General and Branding settings are Admin and Owner only (AUTH-03); each page and action checks
// the role. Bank details are Owner only.
export function NavLinks({ showAdminSettings, showOwnerSettings = false, layout, quick = false, className }: NavLinksProps) {
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
      {showAdminSettings && (
        <li>
          <NavItem href="/settings/email" label="Email" layout={layout} icon={<Mail aria-hidden className={ICON} />} />
        </li>
      )}
      {showAdminSettings && !quick && (
        <li>
          <NavItem
            href="/settings/general"
            label="General"
            layout={layout}
            icon={<SlidersHorizontal aria-hidden className={ICON} />}
          />
        </li>
      )}
      {showAdminSettings && !quick && (
        <li>
          <NavItem
            href="/settings/branding"
            label="Branding"
            layout={layout}
            icon={<Palette aria-hidden className={ICON} />}
          />
        </li>
      )}
      {showOwnerSettings && !quick && (
        <li>
          <NavItem href="/settings/payment" label="Bank" layout={layout} icon={<Landmark aria-hidden className={ICON} />} />
        </li>
      )}
    </ul>
  );
}
