import type { APIRoute } from "astro";

import { addStoreCartLineItem, ensureStoreCart } from "../../../lib/commerce/cart.js";
import { cartJson, cartJsonError } from "../../../lib/commerce/cart-json.js";
import { customerFacingStoreError } from "../../../lib/commerce/errors.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { loadPageContext } from "../../../lib/page-context.js";
import { appendSetCookies, cartIdSetCookie } from "../../../lib/session/cart-cookie.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const variantId = String(form.get("variantId") ?? "").trim();
  const quantity = Math.max(1, Number(form.get("quantity") ?? "1") || 1);
  const returnTo = String(form.get("returnTo") ?? "/cart").trim() || "/cart";

  if (!variantId) {
    return failure(returnTo, "Choose a product option before adding to cart.", wantsJson);
  }

  const ctx = await loadPageContext(request);
  if (!ctx.ok) {
    return failure(returnTo, customerFacingStoreError(ctx.message), wantsJson);
  }

  const customerToken = getCustomerTokenFromRequest(request);
  const customerHeaders = customerToken ? { authorization: `Bearer ${customerToken}` } : undefined;
  const cartResult = await ensureStoreCart({
    cartId: ctx.cartId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    regionId: ctx.config.commerce.regionId,
    requestHost: ctx.requestHost,
    ...(customerHeaders ? { headers: customerHeaders } : {}),
  });

  if (isStoreError(cartResult)) {
    return failure(returnTo, customerFacingStoreError(cartResult.message), wantsJson);
  }

  const addResult = await addStoreCartLineItem({
    cartId: cartResult.cart.id,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    quantity,
    requestHost: getRequestHost(request),
    ...(customerHeaders ? { headers: customerHeaders } : {}),
    variantId,
  });

  if (isStoreError(addResult)) {
    return failure(
      returnTo,
      customerFacingStoreError(addResult.message) ||
        "Could not add that item to your cart. Please try again.",
      wantsJson,
    );
  }

  const headers = new Headers();
  appendSetCookies(headers, [cartIdSetCookie(cartResult.cart.id)]);
  if (wantsJson) {
    return cartJson(addResult.cart, { headers });
  }

  const url = new URL(returnTo, request.url);
  url.searchParams.set("notice", "added");
  headers.set("Location", url.pathname + url.search);
  return new Response(null, { status: 303, headers });
};

function failure(returnTo: string, message: string, wantsJson: boolean) {
  if (wantsJson) {
    return cartJsonError(message);
  }
  const url = new URL(returnTo, "http://local.invalid");
  url.searchParams.set("error", message);
  return new Response(null, {
    status: 303,
    headers: { Location: url.pathname + url.search },
  });
}
