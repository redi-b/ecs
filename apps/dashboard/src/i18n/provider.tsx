"use client";

import {
  formatCalendarDate,
  formatCalendarDateTime,
  formatDualCalendarDate,
  resolveCalendarSystem,
  resolveUserCalendarPreference,
} from "@ecs/date-time";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

import { useCalendarPreference } from "@/components/providers/calendar-preference-provider";

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
  const { preference: calendarPreference } = useCalendarPreference();
  const resolvedCalendarPreference = resolveUserCalendarPreference(calendarPreference);
  const calendarSystem = resolveCalendarSystem(locale, resolvedCalendarPreference);
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    // Resilient in unit test or non-router environments
  }
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
        const response = await fetch("/dashboard/locale", {
          body: JSON.stringify({ locale: nextLocale }),
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          method: "POST",
        }).catch(() => null);

        if (!response?.ok) return false;

        startTransition(() => {
          router?.refresh();
        });
        return true;
      } finally {
        setIsFetchPending(false);
      }
    },
    [locale, router],
  );

  return {
    calendarPreference,
    calendarSystem,
    formatDate: (value: Date | number | string) =>
      formatCalendarDate(value, {
        calendar: resolvedCalendarPreference,
        locale,
      }) ?? "—",
    formatDateTime: (value: Date | number | string) =>
      formatCalendarDateTime(value, {
        calendar: resolvedCalendarPreference,
        locale,
      }) ?? "—",
    formatDualDate: (value: Date | number | string) =>
      formatDualCalendarDate(value, { locale, primary: calendarSystem }),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    isLocalePending: isFetchPending || isTransitionPending,
    locale,
    setLocale,
    t,
  };
}
