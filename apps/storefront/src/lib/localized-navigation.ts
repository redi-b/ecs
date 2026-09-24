import type { StorefrontLanguageSettings, StorefrontLocale } from "@ecs/contracts";
import { localizeStorefrontPath } from "./storefront-locale.js";

const storefrontPagePrefixes = [
  "/account",
  "/about",
  "/cart",
  "/checkout",
  "/contact",
  "/order",
  "/products",
  "/request-item",
  "/wishlist",
] as const;

export function localizeStorefrontNavigationHtml(input: {
  html: string;
  locale: StorefrontLocale;
  settings: StorefrontLanguageSettings;
}) {
  if (input.locale === input.settings.defaultLocale) return input.html;
  return input.html.replace(
    /<a\b[^>]*\bhref=(['"])(\/[^'"<>]*)\1[^>]*>/g,
    (tag, quote, href: string) => {
      if (/\bdata-storefront-locale(?:=|\s|>)/.test(tag)) return tag;
      const url = new URL(href, "https://storefront.invalid");
      if (!isStorefrontPagePath(url.pathname, input.settings)) return tag;
      const pathname = localizeStorefrontPath({
        locale: input.locale,
        pathname: url.pathname,
        settings: input.settings,
      });
      return tag.replace(
        `href=${quote}${href}${quote}`,
        `href=${quote}${pathname}${url.search}${url.hash}${quote}`,
      );
    },
  );
}

function isStorefrontPagePath(pathname: string, settings: StorefrontLanguageSettings) {
  if (pathname === "/") return true;
  if (
    settings.enabledLocales.some(
      (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    )
  ) {
    return false;
  }
  return storefrontPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function localizeStorefrontNavigationResponse(input: {
  response: Response;
  locale: StorefrontLocale;
  settings: StorefrontLanguageSettings;
  method: string;
}) {
  if (
    input.method === "HEAD" ||
    input.locale === input.settings.defaultLocale ||
    !input.response.headers.get("content-type")?.includes("text/html")
  ) {
    return input.response;
  }
  const headers = new Headers(input.response.headers);
  headers.delete("content-length");
  return new Response(
    localizeStorefrontNavigationHtml({
      html: await input.response.text(),
      locale: input.locale,
      settings: input.settings,
    }),
    {
      headers,
      status: input.response.status,
      statusText: input.response.statusText,
    },
  );
}
