import type { APIRoute } from "astro";

import { updateStoreCartLineItem } from "../../../lib/commerce/cart.js";
import { loadPageContext } from "../../../lib/page-context.js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const lineItemId = String(form.get("lineItemId") ?? "").trim();
  const quantity = Math.max(1, Number(form.get("quantity") ?? "1") || 1);

  const ctx = await loadPageContext(request);
  if (!ctx.ok || !ctx.cartId) {
    return redirect("/cart?error=" + encodeURIComponent("Cart not found."));
  }

  if (!lineItemId) {
    return redirect("/cart?error=" + encodeURIComponent("Missing cart item."));
  }

  const result = await updateStoreCartLineItem({
    cartId: ctx.cartId,
    lineItemId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    quantity,
    requestHost: ctx.requestHost,
  });

  if ("ok" in result && result.ok === false) {
    return redirect(
      "/cart?error=" +
        encodeURIComponent("Could not update your cart. Please try again."),
    );
  }

  return redirect("/cart");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
