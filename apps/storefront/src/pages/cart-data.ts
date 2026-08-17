import type { APIRoute } from "astro";
import { cartJson, cartJsonError } from "../lib/commerce/cart-json.js";
import { getStoreCart } from "../lib/commerce/cart.js";
import { isStoreError } from "../lib/commerce/result.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../lib/env.js";
import { getCartIdFromRequest } from "../lib/session/cart-cookie.js";

export const GET: APIRoute = async ({ request }) => {
  const cartId = getCartIdFromRequest(request);
  if (!cartId) return cartJson({ id: "", regionId: null, email: null, currencyCode: null, itemTotal: 0, shippingTotal: 0, total: 0, items: [] });
  const result = await getStoreCart({ cartId, platformApiBaseUrl: getPlatformApiBaseUrl(), requestHost: getRequestHost(request) });
  if (isStoreError(result)) return cartJsonError("Could not load your cart. Please try again.", result.status);
  return cartJson(result.cart);
};
