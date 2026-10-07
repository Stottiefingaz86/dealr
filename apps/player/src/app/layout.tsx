import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-dealr-display",
  weight: ["400", "500", "600"],
});

const ui = Outfit({
  subsets: ["latin"],
  variable: "--font-dealr-ui",
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Live Dealr",
  description: "Private-table live blackjack. The dealer is the hero.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${ui.variable} antialiased`}>{children}</body>
    </html>
  );
}
