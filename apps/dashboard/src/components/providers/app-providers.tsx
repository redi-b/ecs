"use client";

import type { ReactNode } from "react";
import NextTopLoader from "nextjs-toploader";

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
          {/*
            Shows on <Link> navigations (and history changes).
            Programmatic router.push/replace (filters, settings tabs) does not
            start the bar unless we later switch those call sites to
            nextjs-toploader/app useRouter — then we can skip same-path updates.
          */}
          <NextTopLoader
            color="var(--primary)"
            crawl
            crawlSpeed={180}
            easing="var(--ease-dashboard)"
            height={2}
            shadow={false}
            showSpinner={false}
            speed={180}
            zIndex={9999}
          />
          {children}
          <Toaster richColors />
        </QueryProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
