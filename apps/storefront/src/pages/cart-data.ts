import type { APIRoute } from "astro";
import { cartJson, cartJsonError } from "../lib/commerce/cart-json.js";
import { getStoreCart } from "../lib/commerce/cart.js";
import { createEmptyStoreCart } from "../lib/commerce/normalize.js";
import { isStoreError } from "../lib/commerce/result.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../lib/env.js";
import { getCartIdFromRequest } from "../lib/session/cart-cookie.js";
import { getCustomerTokenFromRequest } from "../lib/session/customer-cookie.js";

export const GET: APIRoute = async ({ request }) => {
  const cartId = getCartIdFromRequest(request);
  if (!cartId) return cartJson(createEmptyStoreCart());
  const customerToken = getCustomerTokenFromRequest(request);
  const result = await getStoreCart({ cartId, platformApiBaseUrl: getPlatformApiBaseUrl(), requestHost: getRequestHost(request), ...(customerToken ? { headers: { authorization: `Bearer ${customerToken}` } } : {}) });
  if (isStoreError(result)) return cartJsonError("Could not load your cart. Please try again.", result.status);
  return cartJson(result.cart);
};
