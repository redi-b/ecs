import type { APIRoute } from "astro";
import { ethiopianPhoneSchema } from "@ecs/contracts";

import { associateRequestCartWithCustomer } from "../../../lib/commerce/customer-cart.js";
import { updateStoreCart } from "../../../lib/commerce/cart.js";
import { initializeChapaCheckout } from "../../../lib/commerce/checkout.js";
import { saveCheckoutAddressIfRequested } from "../../../lib/commerce/checkout-address.js";
import { getStoreDeliveryOptions } from "../../../lib/commerce/delivery.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { getStorefrontActionLocale } from "../../../lib/action-locale.js";
import { setStoreCartShippingMethod } from "../../../lib/commerce/shipping.js";
import { loadPageContext } from "../../../lib/page-context.js";
import * as m from "../../../paraglide/messages.js";

/**
 * Prepares the cart, then asks Platform to start Chapa with **merchant** credentials.
 * Platform must not use billing/platform CHAPA_SECRET_KEY for this path.
 */
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
    locale: ctx.commerceLocale,
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
  const parsedPhone = ethiopianPhoneSchema.safeParse(String(form.get("phone") ?? "").trim());
  const phone = parsedPhone.success ? parsedPhone.data : "";
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

  if (!email) {
    return redirect(
      "/checkout?error=" +
        encodeURIComponent(m.checkout_email_valid_required({}, { locale })),
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

  if (!phone) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_phone_valid_required({}, { locale })),
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

  const resolvedAddress1 = deliveryChoice === "pickup" ? address1 || "Pickup" : address1;
  const resolvedCity = deliveryChoice === "pickup" ? city || "Pickup" : city;

  const updateResult = await updateStoreCart({
    cartId: ctx.cartId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    body: {
      ...(email ? { email } : {}),
      shipping_address: {
        first_name: name,
        ...(phone ? { phone } : {}),
        address_1: resolvedAddress1,
        city: resolvedCity,
        country_code: "et",
      },
      metadata: {
        payment_method: "chapa",
        delivery_choice: deliveryChoice,
        customer_name: name,
        customer_phone: phone || null,
        landmark,
        customer_notes: notes,
      },
    },
  });

  if (isStoreError(updateResult)) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_could_not_continue({}, { locale })),
    );
  }

  const shippingResult = await setStoreCartShippingMethod({
    cartId: ctx.cartId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    shippingOptionId,
    data: {
      delivery_choice: deliveryChoice,
      landmark,
      customer_notes: notes,
    },
  });

  if (isStoreError(shippingResult)) {
    return redirect(
      "/checkout?error=" + encodeURIComponent(m.checkout_could_not_continue({}, { locale })),
    );
  }

  const origin = new URL(request.url).origin;
  const returnUrl = new URL("/checkout/payment-return", origin).toString();

  const chapaResult = await initializeChapaCheckout({
    cartId: ctx.cartId,
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
    returnUrl,
  });

  if (isStoreError(chapaResult)) {
    const message =
      chapaResult.message === "merchant_chapa_not_configured"
        ? m.checkout_online_payment_unavailable({}, { locale })
        : m.checkout_could_not_continue({}, { locale });
    return redirect("/checkout?error=" + encodeURIComponent(message));
  }

  return redirect(chapaResult.checkoutUrl);
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
