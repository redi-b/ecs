import type { APIRoute } from "astro";
import { addStoreCartPromotion, removeStoreCartPromotion } from "../../../lib/commerce/cart.js";
import { cartJson, cartJsonError } from "../../../lib/commerce/cart-json.js";
import { isStoreError } from "../../../lib/commerce/result.js";
import { getCartIdFromRequest } from "../../../lib/session/cart-cookie.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";

export const POST: APIRoute = async ({ request, redirect }) => {
  const wantsJson = request.headers.get("accept")?.includes("application/json") === true;
  const cartId = getCartIdFromRequest(request);
  if (!cartId) return wantsJson ? cartJsonError("Cart not found.", 404) : redirect("/cart");

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "apply");
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!code) {
    const message = "Enter a discount code.";
    return wantsJson ? cartJsonError(message, 400) : redirect(`/cart?error=${encodeURIComponent(message)}`);
  }

  const requestOptions = {
    cartId,
    code,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
  };
  const result =
    intent === "remove"
      ? await removeStoreCartPromotion(requestOptions)
      : await addStoreCartPromotion(requestOptions);

  if (isStoreError(result)) {
    const message =
      intent === "remove"
        ? "We could not remove that discount. Please try again."
        : result.status === 404
          ? "We could not find that discount code."
          : "That discount code could not be applied. Check the code and try again.";
    return wantsJson ? cartJsonError(message, result.status) : redirect(`/cart?error=${encodeURIComponent(message)}`);
  }

  return wantsJson ? cartJson(result.cart) : redirect("/cart");
};
