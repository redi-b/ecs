import type { StorefrontLocale } from "@ecs/contracts";

export function storefrontLocaleTag(locale: StorefrontLocale) {
  return locale === "am" ? "am-ET" : "en-ET";
}

export function formatStorefrontDate(
  value: string | Date,
  locale: StorefrontLocale,
  dateStyle: "short" | "medium" | "long" | "full" = "medium",
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(storefrontLocaleTag(locale), {
    dateStyle,
    timeZone: "Africa/Addis_Ababa",
  }).format(date);
}
