import type { APIRoute } from "astro";

import { completeCodCheckout } from "../../../lib/commerce/checkout.js";
import { saveCheckoutAddressIfRequested } from "../../../lib/commerce/checkout-address.js";
import { associateRequestCartWithCustomer } from "../../../lib/commerce/customer-cart.js";
import { getStoreDeliveryOptions } from "../../../lib/commerce/delivery.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { getStorefrontActionLocale } from "../../../lib/action-locale.js";
import { loadPageContext } from "../../../lib/page-context.js";
import {
  appendSetCookies,
  cartIdClearCookie,
  lastOrderSetCookie,
} from "../../../lib/session/cart-cookie.js";
import * as m from "../../../paraglide/messages.js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ctx = await loadPageContext(request);
  const locale = ctx.ok ? ctx.locale : getStorefrontActionLocale(request);

  if (!ctx.ok || !ctx.cartId) {
    return redirect("/checkout?error=" + encodeURIComponent(m.cart_not_found({}, { locale })));
  }

  const association = await associateRequestCartWithCustomer(request, {
    cartId: ctx.cartId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
  });
  if (!association.ok) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_could_not_continue({}, { locale })),
    );
  }

  const deliveryResult = await getStoreDeliveryOptions({
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
  });
  const delivery =
    !isStoreError(deliveryResult) ? deliveryResult.delivery : null;

  const name = String(form.get("name") ?? `${form.get("firstName") ?? ""} ${form.get("lastName") ?? ""}`).trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim() || null;
  const deliveryChoice = String(form.get("deliveryChoice") ?? "").trim();
  const address1 = String(form.get("address1") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const landmark = String(form.get("landmark") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const shippingOptionId = String(form.get("shippingOptionId") ?? "").trim();

  if (!name || !shippingOptionId || (deliveryChoice !== "delivery" && deliveryChoice !== "pickup")) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_missing_required({}, { locale })),
    );
  }

  if (delivery && !delivery.deliveryEnabled && !delivery.pickupEnabled) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_fulfillment_unavailable({}, { locale })),
    );
  }

  if (deliveryChoice === "delivery" && delivery && !delivery.deliveryEnabled) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_delivery_unavailable({}, { locale })),
    );
  }

  if (deliveryChoice === "pickup" && delivery && !delivery.pickupEnabled) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_pickup_unavailable({}, { locale })),
    );
  }

  if (delivery?.phoneConfirmationRequired !== false && !phone) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_phone_required({}, { locale })),
    );
  }

  if (deliveryChoice === "delivery") {
    if (!address1 || !city) {
      return redirect(
        "/checkout?error=" + encodeURIComponent(m.checkout_address_required({}, { locale })),
      );
    }
    if (delivery?.landmarkRequired && !landmark) {
      return redirect(
        "/checkout?error=" + encodeURIComponent(m.checkout_landmark_required({}, { locale })),
      );
    }
  }

  const addressSave = await saveCheckoutAddressIfRequested(request, form, {
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
  });
  if (!addressSave.ok) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_could_not_continue({}, { locale })),
    );
  }

  const result = await completeCodCheckout({
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    input: {
      cartId: ctx.cartId,
      shippingOptionId,
      deliveryChoice: deliveryChoice as "delivery" | "pickup",
      customer: { name, phone, email },
      address: {
        address1: deliveryChoice === "pickup" ? address1 || "Pickup" : address1,
        city: deliveryChoice === "pickup" ? city || "Pickup" : city,
        landmark,
      },
      notes,
    },
  });

  if (isStoreError(result)) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_could_not_continue({}, { locale })),
    );
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
