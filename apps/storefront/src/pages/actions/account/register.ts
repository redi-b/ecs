import type { APIRoute } from "astro";

import { authenticateStoreCustomer, transferStoreCartToCustomer } from "../../../lib/commerce/account.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { customerSessionSetCookie } from "../../../lib/session/customer-cookie.js";
import { getCartIdFromRequest } from "../../../lib/session/cart-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const result = await authenticateStoreCustomer({
    email: String(form.get("email") ?? "").trim(),
    firstName: String(form.get("firstName") ?? "").trim(),
    lastName: String(form.get("lastName") ?? "").trim(),
    password: String(form.get("password") ?? ""),
    mode: "register",
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
  });
  if (!("token" in result)) return redirect(`/account?mode=register&error=${encodeURIComponent(result.message)}`);
  const cartId = getCartIdFromRequest(request);
  if (cartId) await transferStoreCartToCustomer({
    cartId,
    token: result.token,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
  });
  const headers = new Headers({ Location: "/account" });
  headers.append("Set-Cookie", customerSessionSetCookie(result.token));
  return new Response(null, { status: 303, headers });
};

function redirect(location: string) { return new Response(null, { status: 303, headers: { Location: location } }); }
