import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { getRequestMessages } from "@/i18n/server";

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
 * Note: "Google Sans" is not available via next/font (proprietary).
 * Noto Sans Ethiopic is Google's open family for Ethiopic scripts and pairs well with Geist for Latin.
 */
const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-ethiopic",
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ECS Dashboard",
  description: "Merchant console for commerce operations",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = await getRequestMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoEthiopic.variable} font-sans antialiased`}
      >
        <AppProviders locale={locale} messages={messages}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
