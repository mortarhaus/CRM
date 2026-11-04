"use client";

import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// stacked: icon over its name (the rail and the phone tab bar); row: icon beside its name (the menu drawer).
const navItemVariants = cva(
  "relative flex items-center rounded-xl font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      layout: {
        stacked: "min-h-14 min-w-18 flex-col justify-center gap-1 px-2 py-1.5 text-xs",
        row: "min-h-11 gap-3 px-3 text-sm",
      },
    },
    defaultVariants: { layout: "stacked" },
  },
);

export interface NavItemProps extends VariantProps<typeof navItemVariants> {
  href: string;
  label: string;
  icon: ReactNode;
  // Shown only when a feature has something to count; no Phase 2 destination has one yet.
  count?: number;
}

export function NavItem({ href, label, icon, count, layout }: NavItemProps) {
  const current = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        navItemVariants({ layout }),
        current && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className="absolute right-1 top-1 min-w-5 rounded-full bg-foreground px-1 text-center text-[0.6875rem] leading-5 text-background">
          {count}
        </span>
      )}
    </Link>
  );
}
