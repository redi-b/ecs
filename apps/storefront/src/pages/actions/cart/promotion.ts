import type { APIRoute } from "astro";
import { addStoreCartPromotion, removeStoreCartPromotion } from "../../../lib/commerce/cart.js";
import { cartJson, cartJsonError } from "../../../lib/commerce/cart-json.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { getCartIdFromRequest } from "../../../lib/session/cart-cookie.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";

export const POST: APIRoute = async ({ request, redirect }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") === true;
  const cartId = getCartIdFromRequest(request);
  if (!cartId) return wantsJson ? cartJsonError("Cart not found.", 404) : redirect("/cart");

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "apply");
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!code) {
    const message = "Enter a discount code.";
    return wantsJson ? cartJsonError(message, 400) : redirect(`/cart?discountError=${encodeURIComponent(message)}`);
  }
  const customerToken = getCustomerTokenFromRequest(request);

  const requestOptions = {
    cartId,
    code,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
    ...(customerToken
      ? { headers: { authorization: `Bearer ${customerToken}` } }
      : {}),
  };
  const result =
    intent === "remove"
      ? await removeStoreCartPromotion(requestOptions)
      : await addStoreCartPromotion(requestOptions);

  if (isStoreError(result)) {
    const message =
      intent === "remove"
        ? "Could not remove this discount. Try again."
        : result.status === 404
          ? "Code not found."
          : result.status === 400 || result.status === 422
            ? "This code does not apply to your cart."
            : "Could not apply this code. Try again.";
    return wantsJson ? cartJsonError(message, result.status) : redirect(`/cart?discountError=${encodeURIComponent(message)}`);
  }

  return wantsJson ? cartJson(result.cart) : redirect("/cart");
};
