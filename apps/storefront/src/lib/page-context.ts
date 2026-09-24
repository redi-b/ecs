import {
  storefrontCommerceLocale,
  type PublishedStorefrontConfig,
  type StorefrontCommerceLocale,
  type StorefrontLocale,
} from "@ecs/contracts";
import { getStorefrontTemplateTranslationDefaults } from "@ecs/storefront-templates";
import { getStoreCart } from "./commerce/cart.js";
import type { StoreCart, StorefrontError } from "./commerce/types.js";
import { getPlatformApiBaseUrl, getRequestHost } from "./env.js";
import { getStorefrontPublicOrigin } from "./seo-origin.js";
import { getCartIdFromRequest } from "./session/cart-cookie.js";
import { getCustomerTokenFromRequest } from "./session/customer-cookie.js";
import { getPublishedStorefrontConfig } from "./storefront-config.js";
import { applyLocalizedContent } from "./localized-content.js";
import { getStorefrontLocaleFromRequest } from "./storefront-locale.js";

export type PageContext =
  | {
      ok: true;
      config: PublishedStorefrontConfig;
      platformApiBaseUrl: string;
      requestHost: string | null;
      publicOrigin: string;
      cartId: string | null;
      cart: StoreCart | null;
      cartCount: number;
      locale: StorefrontLocale;
      commerceLocale: StorefrontCommerceLocale;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export async function loadPageContext(
  request: Request,
  options?: {
    /** Skip cart cookie fetch (public catalog pages that defer cart badge). */
    skipCart?: boolean;
    /** Short-lived capability used only by the editor preview route. */
    previewToken?: string;
    /** Explicit preview language. Public requests always resolve language from the URL. */
    locale?: StorefrontLocale;
  },
): Promise<PageContext> {
  const platformApiBaseUrl = getPlatformApiBaseUrl();
  const requestHost = getRequestHost(request);
  const configResult = await getPublishedStorefrontConfig({
    platformApiBaseUrl,
    previewToken: options?.previewToken,
    requestHost,
  });

  if (!configResult.ok) {
    return {
      ok: false,
      status: configResult.status,
      message: configResult.message,
    };
  }

  const locale = options?.locale && configResult.config.storefront.languageSettings.enabledLocales.includes(options.locale)
    ? options.locale
    : getStorefrontLocaleFromRequest(request, configResult.config.storefront.languageSettings);
  const commerceLocale = storefrontCommerceLocale(locale);
  const templateDefaults =
    locale === "am"
      ? getStorefrontTemplateTranslationDefaults(
          configResult.config.storefront.templateKey,
          locale,
        )
      : undefined;
  const localizedData = applyLocalizedContent({
    source: configResult.config.storefront.data,
    content: configResult.config.storefront.localizedContent,
    locale,
    defaults: templateDefaults,
  });
  const localizedSeo = applyLocalizedContent({
    source: configResult.config.storefront.seo,
    content: configResult.config.storefront.localizedContent,
    locale,
    prefix: "seo",
  });
  const config = {
    ...configResult.config,
    storefront: {
      ...configResult.config.storefront,
      data: localizedData,
      seo: localizedSeo,
    },
  };

  if (options?.skipCart) {
    return {
      ok: true,
      config,
      platformApiBaseUrl,
      requestHost,
      publicOrigin: getStorefrontPublicOrigin(config),
      cartId: null,
      cart: null,
      cartCount: 0,
      locale,
      commerceLocale,
    };
  }

  const cartId = getCartIdFromRequest(request);
  const customerToken = getCustomerTokenFromRequest(request);
  let cart: StoreCart | null = null;

  if (cartId) {
    const cartResult = await getStoreCart({
      cartId,
      platformApiBaseUrl,
      requestHost,
      locale: commerceLocale,
      ...(customerToken ? { headers: { authorization: `Bearer ${customerToken}` } } : {}),
    });
    if (!isError(cartResult) && cartResult.cart.id) {
      cart = cartResult.cart;
    }
  }

  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return {
    ok: true,
      config,
    platformApiBaseUrl,
    requestHost,
    publicOrigin: getStorefrontPublicOrigin(config),
    cartId: cart?.id ?? null,
    cart,
    cartCount,
    locale,
    commerceLocale,
  };
}

function isError(value: unknown): value is StorefrontError {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}
