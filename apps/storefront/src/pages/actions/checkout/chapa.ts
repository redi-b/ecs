import type { APIRoute } from "astro";

import { updateStoreCart } from "../../../lib/commerce/cart.js";
import { initializeChapaCheckout } from "../../../lib/commerce/checkout.js";
import { getStoreDeliveryOptions } from "../../../lib/commerce/delivery.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { setStoreCartShippingMethod } from "../../../lib/commerce/shipping.js";
import { loadPageContext } from "../../../lib/page-context.js";

/**
 * Prepares the cart, then asks Platform to start Chapa with **merchant** credentials.
 * Platform must not use billing/platform CHAPA_SECRET_KEY for this path.
 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const ctx = await loadPageContext(request);

  if (!ctx.ok || !ctx.cartId) {
    return redirect("/checkout?error=" + encodeURIComponent("Cart not found."));
  }

  const deliveryResult = await getStoreDeliveryOptions({
    platformApiBaseUrl: ctx.platformApiBaseUrl,
    requestHost: ctx.requestHost,
  });
  const delivery =
    !isStoreError(deliveryResult) ? deliveryResult.delivery : null;

  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim() || null;
  const deliveryChoice = String(form.get("deliveryChoice") ?? "").trim();
  const address1 = String(form.get("address1") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const landmark = String(form.get("landmark") ?? "").trim() || null;
  const notes = String(form.get("notes") ?? "").trim() || null;
  const shippingOptionId = String(form.get("shippingOptionId") ?? "").trim();

  if (!name || !shippingOptionId || (deliveryChoice !== "delivery" && deliveryChoice !== "pickup")) {
    return redirect("/checkout?error=" + encodeURIComponent("Please fill all required fields."));
  }

  if (delivery && !delivery.deliveryEnabled && !delivery.pickupEnabled) {
    return redirect(
      "/checkout?error=" + encodeURIComponent("This shop is not accepting delivery or pickup right now."),
    );
  }

  if (deliveryChoice === "delivery" && delivery && !delivery.deliveryEnabled) {
    return redirect("/checkout?error=" + encodeURIComponent("Delivery is not available for this shop."));
  }

  if (deliveryChoice === "pickup" && delivery && !delivery.pickupEnabled) {
    return redirect("/checkout?error=" + encodeURIComponent("Pickup is not available for this shop."));
  }

  if (delivery?.phoneConfirmationRequired !== false && !phone) {
    return redirect("/checkout?error=" + encodeURIComponent("Phone number is required."));
  }

  if (deliveryChoice === "delivery") {
    if (!address1 || !city) {
      return redirect("/checkout?error=" + encodeURIComponent("Address and city are required for delivery."));
    }
    if (delivery?.landmarkRequired && !landmark) {
      return redirect("/checkout?error=" + encodeURIComponent("Landmark is required for delivery."));
    }
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
    return redirect("/checkout?error=" + encodeURIComponent(updateResult.message));
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
    return redirect("/checkout?error=" + encodeURIComponent(shippingResult.message));
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
        ? "This shop has not configured online payments yet. Use cash on delivery or contact the shop."
        : chapaResult.message;
    return redirect("/checkout?error=" + encodeURIComponent(message));
  }

  return redirect(chapaResult.checkoutUrl);
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
