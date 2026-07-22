import type { APIRoute } from "astro";

import { getStoreCart } from "../lib/commerce/cart";
import { getPlatformApiBaseUrl, getRequestHost } from "../lib/env";
import { getCartIdFromRequest } from "../lib/session/cart-cookie";

/**
 * Lightweight no-store endpoint for cart badge on publicly cached pages.
 * Client script in Layout fetches this after paint.
 */
export const GET: APIRoute = async ({ request }) => {
  const cartId = getCartIdFromRequest(request);
  let count = 0;

  if (cartId) {
    const cartResult = await getStoreCart({
      cartId,
      platformApiBaseUrl: getPlatformApiBaseUrl(),
      requestHost: getRequestHost(request),
    });
    if (
      cartResult &&
      typeof cartResult === "object" &&
      "cart" in cartResult &&
      cartResult.cart?.items
    ) {
      count = cartResult.cart.items.reduce((sum, item) => sum + item.quantity, 0);
    }
  }

  return new Response(JSON.stringify({ count }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
};
