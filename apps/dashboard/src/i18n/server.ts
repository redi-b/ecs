import "server-only";

import { getLocale, getTranslations as getNextIntlTranslations } from "next-intl/server";

import type { MessageKey } from "./messages";

/**
 * Server-side translator using full dotted paths (`nav.products`),
 * matching client `useI18n().t`. Thin wrapper over next-intl for a shared MessageKey type.
 */
export async function getTranslations() {
  const t = await getNextIntlTranslations();

  return (key: MessageKey, values?: Record<string, string | number | Date>) => t(key, values);
}

export async function getRequestLocale() {
  return getLocale();
}
