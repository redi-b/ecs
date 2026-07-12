"use client";

import { createContext, type ReactNode, use, useCallback, useMemo } from "react";

import type { AppLocale } from "./config";
import type { MessageKey, Messages } from "./messages";

type I18nContextValue = {
  locale: AppLocale;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale,
  messages,
}: I18nContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const context = use(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  const { locale, messages } = context;

  const t = useCallback(
    (key: MessageKey, values?: Record<string, string | number>) => {
      const message = messages[key];

      if (!values) {
        return message;
      }

      return Object.entries(values).reduce(
        (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
        message,
      );
    },
    [messages],
  );

  return {
    locale,
    t,
    formatDate: (value: Date | number) => new Intl.DateTimeFormat(locale).format(value),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
  };
}
