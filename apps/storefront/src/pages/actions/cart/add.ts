import type { APIRoute } from "astro";

import { addStoreCartLineItem, ensureStoreCart } from "../../../lib/commerce/cart.js";
import { customerFacingStoreError } from "../../../lib/commerce/errors.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { loadPageContext } from "../../../lib/page-context.js";
import { appendSetCookies, cartIdSetCookie } from "../../../lib/session/cart-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const variantId = String(form.get("variantId") ?? "").trim();
  const quantity = Math.max(1, Number(form.get("quantity") ?? "1") || 1);
  const returnTo = String(form.get("returnTo") ?? "/cart").trim() || "/cart";

  if (!variantId) {
    return redirectWithError(returnTo, "Choose a product option before adding to cart.");
  }

  const ctx = await loadPageContext(request);
  if (!ctx.ok) {
    return redirectWithError(returnTo, customerFacingStoreError(ctx.message));
  }

  const cartResult = await ensureStoreCart({
    cartId: ctx.cartId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    regionId: ctx.config.commerce.regionId,
    requestHost: ctx.requestHost,
  });

  if (isStoreError(cartResult)) {
    return redirectWithError(returnTo, customerFacingStoreError(cartResult.message));
  }

  const addResult = await addStoreCartLineItem({
    cartId: cartResult.cart.id,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    quantity,
    requestHost: getRequestHost(request),
    variantId,
  });

  if (isStoreError(addResult)) {
    return redirectWithError(
      returnTo,
      customerFacingStoreError(addResult.message) ||
        "Could not add that item to your cart. Please try again.",
    );
  }

  const url = new URL(returnTo, request.url);
  url.searchParams.set("notice", "added");
  const headers = new Headers({ Location: url.pathname + url.search });
  appendSetCookies(headers, [cartIdSetCookie(cartResult.cart.id)]);
  return new Response(null, { status: 303, headers });
};

function redirectWithError(returnTo: string, message: string) {
  const url = new URL(returnTo, "http://local.invalid");
  url.searchParams.set("error", message);
  return new Response(null, {
    status: 303,
    headers: { Location: url.pathname + url.search },
  });
}
