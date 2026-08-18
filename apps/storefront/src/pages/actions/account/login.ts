import type { APIRoute } from "astro";

import { authenticateStoreCustomer, getRememberedStoreCustomerCart } from "../../../lib/commerce/account.js";
import { associateCartWithCustomer } from "../../../lib/commerce/customer-cart.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { customerSessionSetCookie } from "../../../lib/session/customer-cookie.js";
import { appendSetCookies, cartIdSetCookie, getCartIdFromRequest } from "../../../lib/session/cart-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const json = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const result = await authenticateStoreCustomer({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    mode: "login",
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
  });
  if (!("token" in result)) return json
    ? Response.json({ ok: false, message: result.message }, { status: result.status })
    : redirect(`/account?error=${encodeURIComponent(result.message)}`);
  const cartId = getCartIdFromRequest(request);
  if (cartId) {
    const association = await associateCartWithCustomer({
      cartId,
      token: result.token,
      platformApiBaseUrl: getPlatformApiBaseUrl(),
      requestHost: getRequestHost(request),
    });
    if (!association.ok) {
      const message = "We could not safely connect this cart to your account. Your cart is unchanged; please try signing in again.";
      return json
        ? Response.json({ ok: false, message }, { status: 409 })
        : redirect(`/account?error=${encodeURIComponent(message)}`);
    }
  }
  const restoredCartId = cartId ? null : await getRememberedStoreCustomerCart({
    token: result.token,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
  });
  if (restoredCartId && typeof restoredCartId === "object") {
    return json
      ? Response.json({ ok: false, message: restoredCartId.message }, { status: restoredCartId.status })
      : redirect(`/account?error=${encodeURIComponent(restoredCartId.message)}`);
  }
  const headers = new Headers(json ? undefined : { Location: "/account" });
  appendSetCookies(headers, [
    customerSessionSetCookie(result.token),
    ...(restoredCartId ? [cartIdSetCookie(restoredCartId)] : []),
  ]);
  return json
    ? Response.json({ ok: true, redirectTo: "/account" }, { headers })
    : new Response(null, { status: 303, headers });
};

function redirect(location: string) { return new Response(null, { status: 303, headers: { Location: location } }); }
