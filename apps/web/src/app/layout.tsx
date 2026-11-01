import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The page CSP carries a per-request nonce, which only a dynamic render can put on the scripts (Next CSP guide).
  await connection();
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
