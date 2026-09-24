import {
  type StorefrontLanguageSettings,
  type StorefrontLocale,
  storefrontLocaleSchema,
} from "@ecs/contracts";

export const STOREFRONT_LOCALE_HEADER = "x-ecs-storefront-locale";
export const STOREFRONT_LOCALE_RESOLVED_HEADER = "x-ecs-storefront-locale-resolved";
export const STOREFRONT_LOCALE_COOKIE = "ecs_storefront_locale";
export const STOREFRONT_DEFAULT_LOCALE_HEADER = "x-ecs-storefront-default-locale";
export const STOREFRONT_ENABLED_LOCALES_HEADER = "x-ecs-storefront-enabled-locales";

export function hasResolvedStorefrontLocale(request: Request) {
  return request.headers.get(STOREFRONT_LOCALE_RESOLVED_HEADER) === "1";
}

export function getStorefrontPreviewLocale(url: URL): StorefrontLocale | null {
  const parsed = storefrontLocaleSchema.safeParse(url.searchParams.get("locale"));
  return parsed.success ? parsed.data : null;
}

export type StorefrontLocaleRoute =
  | { action: "render"; locale: StorefrontLocale; pathname: string }
  | { action: "redirect"; locale: StorefrontLocale; pathname: string }
  | { action: "not_found" };

export function resolveStorefrontLocaleRoute(input: {
  pathname: string;
  settings: StorefrontLanguageSettings;
}): StorefrontLocaleRoute {
  const pathname = normalizePathname(input.pathname);
  const [firstSegment] = pathname.slice(1).split("/");
  const parsedLocale = storefrontLocaleSchema.safeParse(firstSegment);

  if (!parsedLocale.success) {
    return { action: "render", locale: input.settings.defaultLocale, pathname };
  }

  const locale = parsedLocale.data;
  if (!input.settings.enabledLocales.includes(locale)) return { action: "not_found" };

  const canonicalPathname = stripLocalePrefix(pathname, locale);
  if (locale === input.settings.defaultLocale) {
    return { action: "redirect", locale, pathname: canonicalPathname };
  }

  return { action: "render", locale, pathname: canonicalPathname };
}

export function localizeStorefrontPath(input: {
  locale: StorefrontLocale;
  pathname: string;
  settings: StorefrontLanguageSettings;
}) {
  const pathname = stripKnownLocalePrefix(normalizePathname(input.pathname));
  if (input.locale === input.settings.defaultLocale) return pathname;
  return pathname === "/" ? `/${input.locale}` : `/${input.locale}${pathname}`;
}

function stripKnownLocalePrefix(pathname: string) {
  const [firstSegment] = pathname.slice(1).split("/");
  const locale = storefrontLocaleSchema.safeParse(firstSegment);
  return locale.success ? stripLocalePrefix(pathname, locale.data) : pathname;
}

export function getStorefrontLocaleFromRequest(
  request: Request,
  settings: StorefrontLanguageSettings,
): StorefrontLocale {
  const parsed = storefrontLocaleSchema.safeParse(request.headers.get(STOREFRONT_LOCALE_HEADER));
  if (parsed.success && settings.enabledLocales.includes(parsed.data)) return parsed.data;

  // Form and fetch actions are deliberately kept at stable, unprefixed endpoints.
  // The page that initiated the action is therefore the authoritative locale.
  const referrer = request.headers.get("referer");
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer);
      const requestUrl = new URL(request.url);
      if (referrerUrl.origin === requestUrl.origin) {
        const route = resolveStorefrontLocaleRoute({
          pathname: referrerUrl.pathname,
          settings,
        });
        if (route.action !== "not_found") return route.locale;
      }
    } catch {
      // Invalid or non-URL referrers are ignored and safely fall back below.
    }
  }

  const preference = readStorefrontLocaleCookie(request.headers.get("cookie"));
  return preference && settings.enabledLocales.includes(preference)
    ? preference
    : settings.defaultLocale;
}

export function getStorefrontLanguageSettingsFromRequest(
  request: Request,
): StorefrontLanguageSettings {
  const defaultLocale = storefrontLocaleSchema.safeParse(
    request.headers.get(STOREFRONT_DEFAULT_LOCALE_HEADER),
  );
  const enabledLocales = (request.headers.get(STOREFRONT_ENABLED_LOCALES_HEADER) ?? "en")
    .split(",")
    .flatMap((value) => {
      const parsed = storefrontLocaleSchema.safeParse(value.trim());
      return parsed.success ? [parsed.data] : [];
    });
  const unique = [...new Set(enabledLocales)];
  const resolvedDefault = defaultLocale.success ? defaultLocale.data : "en";
  return {
    sourceLocale: "en",
    defaultLocale: unique.includes(resolvedDefault) ? resolvedDefault : "en",
    enabledLocales: unique.includes("en") ? unique : ["en", ...unique],
  };
}

export function readStorefrontLocaleCookie(cookieHeader: string | null): StorefrontLocale | null {
  const value = cookieHeader
    ?.split(";")
    .map((item) => item.trim().split("="))
    .find(([name]) => name === STOREFRONT_LOCALE_COOKIE)?.[1];
  const parsed = storefrontLocaleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizePathname(pathname: string) {
  if (!pathname.startsWith("/")) return `/${pathname}`;
  return pathname || "/";
}

function stripLocalePrefix(pathname: string, locale: StorefrontLocale) {
  const stripped = pathname.slice(locale.length + 1);
  return stripped ? (stripped.startsWith("/") ? stripped : `/${stripped}`) : "/";
}
