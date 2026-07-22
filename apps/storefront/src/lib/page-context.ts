import type { PublishedStorefrontConfig } from "@ecs/contracts";

import { getCartIdFromRequest } from "./session/cart-cookie.js";
import { getStoreCart } from "./commerce/cart.js";
import type { StoreCart, StorefrontError } from "./commerce/types.js";
import { getPlatformApiBaseUrl, getRequestHost } from "./env.js";
import { getPublishedStorefrontConfig } from "./storefront-config.js";

export type PageContext =
  | {
      ok: true;
      config: PublishedStorefrontConfig;
      platformApiBaseUrl: string;
      requestHost: string | null;
      cartId: string | null;
      cart: StoreCart | null;
      cartCount: number;
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
  },
): Promise<PageContext> {
  const platformApiBaseUrl = getPlatformApiBaseUrl();
  const requestHost = getRequestHost(request);
  const configResult = await getPublishedStorefrontConfig({
    platformApiBaseUrl,
    requestHost,
  });

  if (!configResult.ok) {
    return {
      ok: false,
      status: configResult.status,
      message: configResult.message,
    };
  }

  if (options?.skipCart) {
    return {
      ok: true,
      config: configResult.config,
      platformApiBaseUrl,
      requestHost,
      cartId: null,
      cart: null,
      cartCount: 0,
    };
  }

  const cartId = getCartIdFromRequest(request);
  let cart: StoreCart | null = null;

  if (cartId) {
    const cartResult = await getStoreCart({
      cartId,
      platformApiBaseUrl,
      requestHost,
    });
    if (!isError(cartResult) && cartResult.cart.id) {
      cart = cartResult.cart;
    }
  }

  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return {
    ok: true,
    config: configResult.config,
    platformApiBaseUrl,
    requestHost,
    cartId: cart?.id ?? null,
    cart,
    cartCount,
  };
}

function isError(value: unknown): value is StorefrontError {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}
