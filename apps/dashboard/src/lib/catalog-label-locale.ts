import type { AppLocale } from "@/i18n/config";

export const CATALOG_LABEL_LOCALE_COOKIE = "ecs_catalog_label_locale";
export const CATALOG_LABEL_LOCALE_EVENT = "ecs-catalog-label-locale";

export const catalogLabelLocaleModes = ["match", "en", "am"] as const;
export type CatalogLabelLocaleMode = (typeof catalogLabelLocaleModes)[number];

export function isCatalogLabelLocaleMode(value: unknown): value is CatalogLabelLocaleMode {
  return typeof value === "string" && catalogLabelLocaleModes.includes(value as CatalogLabelLocaleMode);
}

export function parseCatalogLabelLocaleCookie(value: string | undefined | null): CatalogLabelLocaleMode {
  return isCatalogLabelLocaleMode(value) ? value : "match";
}

export function resolveCatalogDisplayLocale(
  mode: CatalogLabelLocaleMode,
  uiLocale: AppLocale,
): AppLocale {
  return mode === "match" ? uiLocale : mode;
}

export function readCatalogLabelLocaleCookie(): CatalogLabelLocaleMode {
  if (typeof document === "undefined") return "match";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CATALOG_LABEL_LOCALE_COOKIE}=([^;]*)`),
  );
  return parseCatalogLabelLocaleCookie(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function writeCatalogLabelLocaleCookie(mode: CatalogLabelLocaleMode) {
  if (typeof document === "undefined") return;
  document.cookie = `${CATALOG_LABEL_LOCALE_COOKIE}=${mode}; path=/; max-age=31536000; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent(CATALOG_LABEL_LOCALE_EVENT, { detail: { mode } }),
  );
}

export const STOREFRONT_LANGUAGES_CHANGED_EVENT = "ecs-storefront-languages-changed";

export function dispatchStorefrontLanguagesChanged(enabledLocales: string[]) {
  if (typeof window === "undefined") return;
  const amharicEnabled = enabledLocales.includes("am");
  window.dispatchEvent(
    new CustomEvent(STOREFRONT_LANGUAGES_CHANGED_EVENT, {
      detail: { amharicEnabled, enabledLocales },
    }),
  );
}
