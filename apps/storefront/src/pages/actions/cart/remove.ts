import type { APIRoute } from "astro";

import { removeStoreCartLineItem } from "../../../lib/commerce/cart.js";
import { loadPageContext } from "../../../lib/page-context.js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const lineItemId = String(form.get("lineItemId") ?? "").trim();

  const ctx = await loadPageContext(request);
  if (!ctx.ok || !ctx.cartId) {
    return redirect("/cart?error=" + encodeURIComponent("Cart not found."));
  }

  if (!lineItemId) {
    return redirect("/cart?error=" + encodeURIComponent("Missing cart item."));
  }

  const result = await removeStoreCartLineItem({
    cartId: ctx.cartId,
    lineItemId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
  });

  if ("ok" in result && result.ok === false) {
    return redirect(
      "/cart?error=" +
        encodeURIComponent("Could not remove that item. Please try again."),
    );
  }

  return redirect("/cart");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
