"use client";

import type { ReactNode } from "react";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { AppLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { I18nProvider } from "@/i18n/provider";

export function AppProviders({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: AppLocale;
  messages: Messages;
}) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryProvider>
          {children}
          <Toaster richColors />
        </QueryProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
