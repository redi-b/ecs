export const locales = ["en", "am"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "ecs-locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && locales.includes(value as AppLocale);
}

export function getLocaleLabel(locale: AppLocale) {
  return locale === "am" ? "አማርኛ" : "English";
}
