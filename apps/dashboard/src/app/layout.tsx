import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import { cookies } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import type { AppLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import {
  getThemeBootstrapScript,
  parseSharedThemeCookieValue,
  SHARED_THEME_COOKIE,
  type SharedTheme,
} from "@/lib/shared-theme";
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

/** Noto Sans Ethiopic for `am` locale (next/font; avoids thin system Ethiopic). */
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
  const cookieStore = await cookies();
  const themePreference: SharedTheme =
    parseSharedThemeCookieValue(cookieStore.get(SHARED_THEME_COOKIE)?.value) ?? "system";
  // Only bake explicit dark into SSR class (system still resolved client-side).
  const ssrDark = themePreference === "dark";

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      // Keep font className stable across locale refreshes (locale faces on body).
      // Theme class may be set here for explicit dark and by bootstrap script.
      className={cn(
        geistSans.variable,
        geistMono.variable,
        notoEthiopic.variable,
        ssrDark && "dark",
      )}
      style={
        themePreference === "dark"
          ? { colorScheme: "dark" }
          : themePreference === "light"
            ? { colorScheme: "light" }
            : undefined
      }
    >
      <head>
        {/* Cookie-first theme before paint — critical on first hit of a new shop host. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny blocking theme bootstrap
          dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }}
        />
      </head>
      <body
        className={cn(
          "min-h-dvh font-sans antialiased",
          isAmharic ? notoEthiopic.className : geistSans.className,
        )}
      >
        <AppProviders locale={locale} messages={messages} theme={themePreference}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
