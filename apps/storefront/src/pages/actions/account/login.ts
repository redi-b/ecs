import type { APIRoute } from "astro";

import { authenticateStoreCustomer, getRememberedStoreCustomerCart } from "../../../lib/commerce/account.js";
import { associateCartWithCustomer } from "../../../lib/commerce/customer-cart.js";
import { getStorefrontActionLocale } from "../../../lib/action-locale.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { customerSessionSetCookie } from "../../../lib/session/customer-cookie.js";
import { appendSetCookies, cartIdSetCookie, getCartIdFromRequest } from "../../../lib/session/cart-cookie.js";
import * as m from "../../../paraglide/messages.js";

export const POST: APIRoute = async ({ request }) => {
  const locale = getStorefrontActionLocale(request);
  const json = request.headers.get("accept")?.includes("application/json") ?? false;
  const form = await request.formData();
  const result = await authenticateStoreCustomer({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    mode: "login",
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
  });
  if (!("token" in result)) {
    const message = m.account_sign_in_failed({}, { locale });
    return json
      ? Response.json({ ok: false, message }, { status: result.status })
      : redirect(`/account?error=${encodeURIComponent(message)}`);
  }
  const cartId = getCartIdFromRequest(request);
  if (cartId) {
    const association = await associateCartWithCustomer({
      cartId,
      token: result.token,
      platformApiBaseUrl: getPlatformApiBaseUrl(),
      requestHost: getRequestHost(request),
    });
    if (!association.ok) {
      const message = m.account_cart_link_failed({}, { locale });
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
    const message = m.account_cart_link_failed({}, { locale });
    return json
      ? Response.json({ ok: false, message }, { status: restoredCartId.status })
      : redirect(`/account?error=${encodeURIComponent(message)}`);
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
