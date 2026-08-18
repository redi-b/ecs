import type { APIRoute } from "astro";

import { updateStoreCustomer } from "../../../lib/commerce/account.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const token = getCustomerTokenFromRequest(request);
  if (!token) return redirect("/account?error=Sign%20in%20to%20update%20your%20profile.");

  const form = await request.formData();
  const result = await updateStoreCustomer({
    firstName: String(form.get("firstName") ?? "").trim(),
    lastName: String(form.get("lastName") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
    token,
  });

  if ("ok" in result) {
    return redirect(`/account?error=${encodeURIComponent(result.message)}`);
  }
  return redirect("/account?saved=profile");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
