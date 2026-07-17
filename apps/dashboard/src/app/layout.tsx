import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import type { AppLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Amharic / Ethiopic UI face.
 *
 * Google Sans is proprietary and not available via next/font.
 * Noto Sans Ethiopic is Google’s open Ethiopic family (same designer lineage as
 * the Google Fonts preview). We apply its className when locale is `am` so the
 * browser cannot fall back to a thin system Ethiopic face.
 */
const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  applicationName: "ECS",
  title: {
    default: "ECS Dashboard",
    template: "%s · ECS",
  },
  description: "Merchant console for commerce operations",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as AppLocale;
  const messages = (await getMessages()) as Messages;
  const isAmharic = locale === "am";

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      // Keep className stable across locale refreshes. Locale-specific font
      // faces go on <body>. Putting changing classes here makes RSC refresh
      // replace the whole attribute and strip next-themes' `dark` class.
      className={cn(geistSans.variable, geistMono.variable, notoEthiopic.variable)}
    >
      <body
        className={cn(
          "min-h-dvh font-sans antialiased",
          // Explicit Ethiopic face for Amharic; Geist for other locales.
          isAmharic ? notoEthiopic.className : geistSans.className,
        )}
      >
        <AppProviders locale={locale} messages={messages}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
