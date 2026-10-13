import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Olsen Tower of Doom",
    template: "%s · Olsen Tower of Doom",
  },
  description: "A 3D feedback quiz tower: 12 floors, the 2 A's of Feedback.",
  applicationName: "Olsen Tower of Doom",
};

export const viewport: Viewport = {
  themeColor: "#0b0614",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${pressStart.variable} h-full antialiased`}>
      <body className="doom-bg flex min-h-full flex-col bg-bg font-sans text-text">{children}</body>
    </html>
  );
}
