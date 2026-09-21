"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AppLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import {
  CATALOG_LABEL_LOCALE_EVENT,
  type CatalogLabelLocaleMode,
  parseCatalogLabelLocaleCookie,
  readCatalogLabelLocaleCookie,
  resolveCatalogDisplayLocale,
  writeCatalogLabelLocaleCookie,
} from "@/lib/catalog-label-locale";

type CatalogLabelLocaleContextValue = {
  amharicEnabled: boolean;
  displayLocale: AppLocale;
  mode: CatalogLabelLocaleMode;
  setMode: (mode: CatalogLabelLocaleMode) => void;
};

const CatalogLabelLocaleContext = createContext<CatalogLabelLocaleContextValue | null>(null);

export function CatalogLabelLocaleProvider({
  amharicEnabled = true,
  children,
  initialMode = "match",
}: {
  amharicEnabled?: boolean;
  children: ReactNode;
  initialMode?: CatalogLabelLocaleMode;
}) {
  const { locale } = useI18n();
  const [mode, setModeState] = useState<CatalogLabelLocaleMode>(
    () => parseCatalogLabelLocaleCookie(initialMode),
  );

  useEffect(() => {
    setModeState(readCatalogLabelLocaleCookie());
    function onChange(event: Event) {
      const next = (event as CustomEvent<{ mode?: unknown }>).detail?.mode;
      if (typeof next === "string") setModeState(parseCatalogLabelLocaleCookie(next));
    }
    window.addEventListener(CATALOG_LABEL_LOCALE_EVENT, onChange);
    return () => window.removeEventListener(CATALOG_LABEL_LOCALE_EVENT, onChange);
  }, []);

  const setMode = useCallback((next: CatalogLabelLocaleMode) => {
    setModeState(next);
    writeCatalogLabelLocaleCookie(next);
  }, []);

  const value = useMemo(
    () => ({
      amharicEnabled,
      displayLocale: amharicEnabled ? resolveCatalogDisplayLocale(mode, locale) : "en",
      mode,
      setMode,
    }),
    [amharicEnabled, locale, mode, setMode],
  );

  return (
    <CatalogLabelLocaleContext.Provider value={value}>{children}</CatalogLabelLocaleContext.Provider>
  );
}

export function useCatalogLabelLocale() {
  const value = useContext(CatalogLabelLocaleContext);
  const { locale } = useI18n();
  if (!value) {
    return {
      amharicEnabled: true,
      displayLocale: locale,
      mode: "match" as const,
      setMode: () => undefined,
    };
  }
  return value;
}
