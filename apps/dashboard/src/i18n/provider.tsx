"use client";

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import type { AppLocale } from "./config";
import { isAppLocale } from "./config";
import type { MessageKey, Messages } from "./messages";
import { messagesByLocale } from "./messages";

type I18nContextValue = {
  locale: AppLocale;
  messages: Messages;
  isLocalePending: boolean;
  setLocale: (locale: AppLocale) => Promise<boolean>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  locale: initialLocale,
  messages: initialMessages,
}: {
  children: ReactNode;
  locale: AppLocale;
  messages: Messages;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [messages, setMessages] = useState(initialMessages);
  const [isFetchPending, setIsFetchPending] = useState(false);
  const [isTransitionPending, startLocaleTransition] = useTransition();

  useEffect(() => {
    setLocaleState(initialLocale);
    setMessages(initialMessages);
  }, [initialLocale, initialMessages]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

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

        startLocaleTransition(() => {
          setLocaleState(nextLocale);
          setMessages(messagesByLocale[nextLocale]);
        });
        return true;
      } finally {
        setIsFetchPending(false);
      }
    },
    [locale],
  );

  const isLocalePending = isFetchPending || isTransitionPending;

  const value = useMemo(
    () => ({
      isLocalePending,
      locale,
      messages,
      setLocale,
    }),
    [isLocalePending, locale, messages, setLocale],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const context = use(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  const { isLocalePending, locale, messages, setLocale } = context;

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
    formatDate: (value: Date | number) => new Intl.DateTimeFormat(locale).format(value),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(value),
    isLocalePending,
    locale,
    setLocale,
    t,
  };
}
