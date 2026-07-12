import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BuddyScript", template: "%s | BuddyScript" },
  description: "Connect, share, and keep up with your community.",
  icons: { icon: "/assets/logo-copy.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
