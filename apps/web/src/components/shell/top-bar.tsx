import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { MenuDrawer } from "./menu-drawer";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

interface TopBarProps {
  theme: Theme;
  user: { name: string; email: string };
  showAdminSettings: boolean;
  showOwnerSettings: boolean;
  // The workspace switcher and sign-out live in the app route group; the bar only places them: in the bar from md up,
  // in the menu drawer below it. So each is rendered twice, and one of the two is always hidden (display: none).
  workspaceSwitcher: ReactNode;
  signOut: ReactNode;
}

// Below md a sticky bar (menu button, product name, theme) as in the Kinlo sample; from md up a plain bar beside the
// rail. No search box or notification bell until those exist (plan Q7, UNI-05).
export function TopBar({ theme, user, showAdminSettings, showOwnerSettings, workspaceSwitcher, signOut }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card md:static">
      <div className="mx-auto flex min-h-15 w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-2.5">
        <MenuDrawer>
          {workspaceSwitcher}
          <nav aria-label="Main">
            <NavLinks showAdminSettings={showAdminSettings} showOwnerSettings={showOwnerSettings} layout="row" className="flex flex-col gap-1" />
          </nav>
          <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex flex-col gap-1">
              <p className="break-words text-sm font-semibold">{user.name}</p>
              <p className="break-all text-sm text-muted-foreground">{user.email}</p>
            </div>
            {signOut}
          </div>
        </MenuDrawer>
        <p className="mr-auto text-lg font-semibold">CRM</p>
        <ThemeToggle theme={theme} />
        <div className="hidden min-w-0 flex-wrap items-center gap-3 md:flex">
          {workspaceSwitcher}
          {signOut}
        </div>
      </div>
    </header>
  );
}
