"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/workspaces", label: "Workspaces" },
  { href: "/settings/security", label: "Security" },
] as const;

// Email settings are Admin and Owner only (AUTH-03); the page and its action check the role themselves.
const EMAIL_SETTINGS_LINK = { href: "/settings/email", label: "Email" } as const;

export function NavLinks({ showEmailSettings }: { showEmailSettings: boolean }) {
  const pathname = usePathname();
  const links = showEmailSettings ? [...LINKS, EMAIL_SETTINGS_LINK] : LINKS;
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-4 text-sm">
        {links.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current && "font-semibold",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
