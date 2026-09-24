import type { StorefrontLocale } from "@ecs/contracts";

import {
  getStorefrontLanguageSettingsFromRequest,
  getStorefrontLocaleFromRequest,
} from "./storefront-locale.js";

/** Resolves the language of the page that initiated an unprefixed form or fetch action. */
export function getStorefrontActionLocale(request: Request): StorefrontLocale {
  return getStorefrontLocaleFromRequest(
    request,
    getStorefrontLanguageSettingsFromRequest(request),
  );
}
