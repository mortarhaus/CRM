import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { currentTheme, themeClass } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

// Self-hosted, so `font-src 'self'` holds and the build fetches nothing (Urbanist, SIL OFL 1.1: fonts/OFL.txt).
const urbanist = localFont({
  src: "./fonts/urbanist-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-urbanist",
});

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The page CSP carries a per-request nonce, which only a dynamic render can put on the scripts (Next CSP guide).
  await connection();
  // The theme class is rendered by the server, so there is no inline script and no flash of the wrong theme.
  const theme = await currentTheme();
  return (
    <html lang="en" className={cn(urbanist.variable, themeClass(theme))}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
