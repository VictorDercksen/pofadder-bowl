import type { Metadata, Viewport } from "next";
import { barlow, barlowCondensed } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pofadder Bowl 2026 · Show Us Your TD’s", template: "%s · Pofadder Bowl 2026" },
  description: "Private fantasy-league punishment experience. Malmesbury to Pofadder and back, 23–25 September 2026.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#183b2f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
