"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

import { type AppLocale, isAppLocale } from "./config";
import type { MessageKey } from "./messages";

/**
 * App-facing i18n hook on top of next-intl.
 * - `t(key)` uses dotted paths into nested messages (`nav.products`)
 * - `setLocale` writes the cookie and refreshes the RSC tree (no path prefixes)
 */
export function useI18n() {
  const tBase = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [isFetchPending, setIsFetchPending] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();

  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number | Date>) => tBase(key, values),
    [tBase],
  );

  const setLocale = useCallback(
    async (nextLocale: AppLocale) => {
      if (!isAppLocale(nextLocale)) return false;
      if (nextLocale === locale) return true;

      setIsFetchPending(true);
      try {
        const response = await fetch("/admin/locale", {
          body: JSON.stringify({ locale: nextLocale }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          method: "POST",
        }).catch(() => null);

        if (!response?.ok) return false;

        startTransition(() => {
          router.refresh();
        });
        return true;
      } finally {
        setIsFetchPending(false);
      }
    },
    [locale, router],
  );

  return {
    formatDate: (value: Date | number) =>
      new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(value instanceof Date ? value : new Date(value)),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    isLocalePending: isFetchPending || isTransitionPending,
    locale,
    setLocale,
    t,
  };
}
