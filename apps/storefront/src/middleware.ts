import { defineMiddleware } from "astro:middleware";

import { getPrimaryDomainRedirect } from "./lib/domain-redirect.js";
import {
  isStorefrontDemoPath,
  resolveBrandedStorefrontDemoPath,
} from "./lib/demo-routes.js";
import { getPlatformApiBaseUrl, getRequestHost } from "./lib/env.js";
import { isPrivateStorefrontPath } from "./lib/seo-routes.js";
import { getPublishedStorefrontConfig } from "./lib/storefront-config.js";

export const onRequest = defineMiddleware(async (context, next) => {
  const brandedDemoPath = resolveBrandedStorefrontDemoPath({
    demoHost: import.meta.env.STOREFRONT_DEMO_HOST,
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

  const platformBaseDomain =
    import.meta.env.STOREFRONT_BASE_DOMAIN ??
    import.meta.env.STOREFRONT_PUBLIC_BASE_DOMAIN ??
    "lvh.me";
  const host = context.url.hostname.toLowerCase();
  const isManagedHost =
    host === platformBaseDomain.toLowerCase() ||
    host.endsWith(`.${platformBaseDomain.toLowerCase()}`);
  if (!isManagedHost && (context.request.method === "GET" || context.request.method === "HEAD")) {
    const config = await getPublishedStorefrontConfig({
      platformApiBaseUrl: getPlatformApiBaseUrl(),
      requestHost: getRequestHost(context.request),
    });
    if (config.ok) {
      const target = getPrimaryDomainRedirect({
        method: context.request.method,
        platformBaseDomain,
        primaryHostname: config.config.tenant.primaryDomain.hostname,
        requestUrl: context.url,
      });
      if (target) return context.redirect(target.href, 308);
    }
  }

  const response = await next();
  if (isPrivateStorefrontPath(context.url.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
});
