import type { APIRoute } from "astro";

import { updateStoreCartLineItem } from "../../../lib/commerce/cart.js";
import { cartJson, cartJsonError } from "../../../lib/commerce/cart-json.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { loadPageContext } from "../../../lib/page-context.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const lineItemId = String(form.get("lineItemId") ?? "").trim();
  const quantity = Math.max(1, Number(form.get("quantity") ?? "1") || 1);

  const ctx = await loadPageContext(request);
  if (!ctx.ok || !ctx.cartId) {
    if (wantsJson) return cartJsonError("Cart not found.", 404);
    return redirect("/cart?error=" + encodeURIComponent("Cart not found."));
  }

  if (!lineItemId) {
    if (wantsJson) return cartJsonError("Missing cart item.");
    return redirect("/cart?error=" + encodeURIComponent("Missing cart item."));
  }
  const customerToken = getCustomerTokenFromRequest(request);

  const result = await updateStoreCartLineItem({
    cartId: ctx.cartId,
    lineItemId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    quantity,
    requestHost: ctx.requestHost,
    ...(customerToken
      ? { headers: { authorization: `Bearer ${customerToken}` } }
      : {}),
  });

  if (isStoreError(result)) {
    if (wantsJson) return cartJsonError("Could not update your cart. Please try again.");
    return redirect(
      "/cart?error=" +
        encodeURIComponent("Could not update your cart. Please try again."),
    );
  }

  return wantsJson ? cartJson(result.cart) : redirect("/cart");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
