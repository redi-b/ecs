import { defineMiddleware } from "astro:middleware";
import { isStorefrontDemoPath, resolveBrandedStorefrontDemoPath } from "./lib/demo-routes.js";
import { getPrimaryDomainRedirect } from "./lib/domain-redirect.js";
import {
  getPlatformApiBaseUrl,
  getRequestHost,
  getStorefrontBaseDomain,
  getStorefrontDemoHost,
} from "./lib/env.js";
import { localizeStorefrontNavigationResponse } from "./lib/localized-navigation.js";
import { isPrivateStorefrontPath } from "./lib/seo-routes.js";
import { getPublishedStorefrontConfig } from "./lib/storefront-config.js";
import {
  getStorefrontLanguageSettingsFromRequest,
  getStorefrontPreviewLocale,
  hasResolvedStorefrontLocale,
  localizeStorefrontPath,
  readStorefrontLocaleCookie,
  resolveStorefrontLocaleRoute,
  STOREFRONT_LOCALE_HEADER,
  STOREFRONT_LOCALE_RESOLVED_HEADER,
} from "./lib/storefront-locale.js";

export const onRequest = defineMiddleware(async (context, next) => {
  const brandedDemoPath = resolveBrandedStorefrontDemoPath({
    demoHost: getStorefrontDemoHost(import.meta.env.STOREFRONT_DEMO_HOST),
    hostname: context.url.hostname,
    pathname: context.url.pathname,
  });
  if (brandedDemoPath) {
    const target = new URL(context.url);
    target.pathname = brandedDemoPath;
    const response = await context.rewrite(target);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (isStorefrontDemoPath(context.url.pathname)) {
    const response = await next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (context.url.pathname === "/preview" && !hasResolvedStorefrontLocale(context.request)) {
    const previewLocale = getStorefrontPreviewLocale(context.url);
    if (previewLocale) {
      return context.rewrite(
        withLocaleHeader(context.request, context.url, previewLocale, {
          sourceLocale: "en",
          defaultLocale: "en",
          enabledLocales: ["en", "am"],
        }),
      );
    }
  }

  // Astro re-enters middleware for rewrites. A resolved locale request must
  // render directly or an unchanged pathname rewrites forever.
  if (hasResolvedStorefrontLocale(context.request)) {
    const response = await next();
    if (isPrivateStorefrontPath(context.url.pathname)) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return localizeStorefrontNavigationResponse({
      response,
      locale: context.request.headers.get(STOREFRONT_LOCALE_HEADER) === "am" ? "am" : "en",
      settings: getStorefrontLanguageSettingsFromRequest(context.request),
      method: context.request.method,
    });
  }

  const platformBaseDomain = getStorefrontBaseDomain({
    buildBaseDomain: import.meta.env.STOREFRONT_BASE_DOMAIN,
    buildPublicBaseDomain: import.meta.env.STOREFRONT_PUBLIC_BASE_DOMAIN,
  });
  const host = context.url.hostname.toLowerCase();
  const isManagedHost =
    host === platformBaseDomain.toLowerCase() ||
    host.endsWith(`.${platformBaseDomain.toLowerCase()}`);
  const isDocumentRequest = context.request.method === "GET" || context.request.method === "HEAD";
  if (isDocumentRequest) {
    const configResult = await getPublishedStorefrontConfig({
      platformApiBaseUrl: getPlatformApiBaseUrl(),
      requestHost: getRequestHost(context.request),
    });
    if (configResult.ok && !isManagedHost) {
      const target = getPrimaryDomainRedirect({
        method: context.request.method,
        platformBaseDomain,
        primaryHostname: configResult.config.tenant.primaryDomain.hostname,
        requestUrl: context.url,
      });
      if (target) return context.redirect(target.href, 308);
    }
    if (configResult.ok) {
      const settings = configResult.config.storefront.languageSettings;
      const route = resolveStorefrontLocaleRoute({ pathname: context.url.pathname, settings });
      if (route.action === "not_found") {
        const target = new URL("/404", context.url);
        const response = await context.rewrite(
          withLocaleHeader(context.request, target, settings.defaultLocale, settings),
        );
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
        return response;
      }
      if (route.action === "redirect") {
        const target = new URL(context.url);
        target.pathname = route.pathname;
        return context.redirect(target.href, 308);
      }
      const preference = readStorefrontLocaleCookie(context.request.headers.get("cookie"));
      if (
        context.url.pathname === "/" &&
        preference &&
        preference !== settings.defaultLocale &&
        settings.enabledLocales.includes(preference)
      ) {
        const target = new URL(context.url);
        target.pathname = localizeStorefrontPath({ locale: preference, pathname: "/", settings });
        return context.redirect(target.href, 307);
      }
      if (route.pathname !== context.url.pathname) {
        const target = new URL(context.url);
        target.pathname = route.pathname;
        const response = await context.rewrite(
          withLocaleHeader(context.request, target, route.locale, settings),
        );
        if (isPrivateStorefrontPath(route.pathname)) {
          response.headers.set("X-Robots-Tag", "noindex, nofollow");
        }
        return localizeStorefrontNavigationResponse({
          response,
          locale: route.locale,
          settings,
          method: context.request.method,
        });
      }
      const response = await context.rewrite(
        withLocaleHeader(context.request, context.url, route.locale, settings),
      );
      if (isPrivateStorefrontPath(route.pathname)) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
      }
      return localizeStorefrontNavigationResponse({
        response,
        locale: route.locale,
        settings,
        method: context.request.method,
      });
    }
  }

  const response = await next();
  if (isPrivateStorefrontPath(context.url.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
});

function withLocaleHeader(
  request: Request,
  url: URL,
  locale: string,
  settings?: import("@ecs/contracts").StorefrontLanguageSettings,
) {
  const headers = new Headers(request.headers);
  headers.set(STOREFRONT_LOCALE_HEADER, locale);
  headers.set(STOREFRONT_LOCALE_RESOLVED_HEADER, "1");
  if (settings) {
    headers.set("x-ecs-storefront-default-locale", settings.defaultLocale);
    headers.set("x-ecs-storefront-enabled-locales", settings.enabledLocales.join(","));
  }
  return new Request(url, { method: request.method, headers });
}
