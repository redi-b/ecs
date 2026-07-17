import type { APIRoute } from "astro";

import { completeCodCheckout } from "../../../lib/commerce/checkout.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { loadPageContext } from "../../../lib/page-context.js";
import {
  appendSetCookies,
  cartIdClearCookie,
  lastOrderSetCookie,
} from "../../../lib/session/cart-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ctx = await loadPageContext(request);

  if (!ctx.ok || !ctx.cartId) {
    return redirect("/checkout?error=" + encodeURIComponent("Cart not found."));
  }

  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim() || null;
  const deliveryChoice = String(form.get("deliveryChoice") ?? "").trim();
  const address1 = String(form.get("address1") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const landmark = String(form.get("landmark") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const shippingOptionId = String(form.get("shippingOptionId") ?? "").trim();

  if (
    !name ||
    !phone ||
    !address1 ||
    !city ||
    !shippingOptionId ||
    (deliveryChoice !== "delivery" && deliveryChoice !== "pickup")
  ) {
    return redirect("/checkout?error=" + encodeURIComponent("Please fill all required fields."));
  }

  const result = await completeCodCheckout({
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    input: {
      cartId: ctx.cartId,
      shippingOptionId,
      deliveryChoice,
      customer: { name, phone, email },
      address: { address1, city, landmark },
      notes,
    },
  });

  if (isStoreError(result)) {
    return redirect("/checkout?error=" + encodeURIComponent(result.message));
  }

  const headers = new Headers({
    Location: `/order/${encodeURIComponent(result.order.id)}`,
  });
  appendSetCookies(headers, [
    cartIdClearCookie(),
    lastOrderSetCookie({
      id: result.order.id,
      total: result.order.total,
      currencyCode: result.order.currencyCode,
    }),
  ]);

  return new Response(null, { status: 303, headers });
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
