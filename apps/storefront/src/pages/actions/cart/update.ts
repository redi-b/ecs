import type { APIRoute } from "astro";

import { updateStoreCartLineItem } from "../../../lib/commerce/cart.js";
import { cartJson, cartJsonError } from "../../../lib/commerce/cart-json.js";
import { customerFacingStoreError } from "../../../lib/commerce/errors.js";
import { getStorefrontActionLocale } from "../../../lib/action-locale.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { loadPageContext } from "../../../lib/page-context.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";
import * as m from "../../../paraglide/messages.js";

export const POST: APIRoute = async ({ request }) => {
  const locale = getStorefrontActionLocale(request);
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const lineItemId = String(form.get("lineItemId") ?? "").trim();
  const quantity = Math.max(1, Number(form.get("quantity") ?? "1") || 1);

  const ctx = await loadPageContext(request);
  if (!ctx.ok || !ctx.cartId) {
    const message = m.cart_not_found({}, { locale });
    if (wantsJson) return cartJsonError(message, 404);
    return redirect("/cart?error=" + encodeURIComponent(message));
  }

  if (!lineItemId) {
    const message = m.cart_item_missing({}, { locale });
    if (wantsJson) return cartJsonError(message);
    return redirect("/cart?error=" + encodeURIComponent(message));
  }
  const customerToken = getCustomerTokenFromRequest(request);

  const result = await updateStoreCartLineItem({
    cartId: ctx.cartId,
    lineItemId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    locale: ctx.commerceLocale,
    quantity,
    requestHost: ctx.requestHost,
    ...(customerToken
      ? { headers: { authorization: `Bearer ${customerToken}` } }
      : {}),
  });

  if (isStoreError(result)) {
    const message =
      locale === "am"
        ? customerFacingStoreError(result.message, locale)
        : customerFacingStoreError(result.message);
    if (wantsJson) return cartJsonError(message);
    return redirect(
      "/cart?error=" +
        encodeURIComponent(message),
    );
  }

  return wantsJson ? cartJson(result.cart) : redirect("/cart");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
