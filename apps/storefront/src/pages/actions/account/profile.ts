import type { APIRoute } from "astro";

import { updateStoreCustomer } from "../../../lib/commerce/account.js";
import { getStorefrontActionLocale } from "../../../lib/action-locale.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";
import * as m from "../../../paraglide/messages.js";

export const POST: APIRoute = async ({ request }) => {
  const locale = getStorefrontActionLocale(request);
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return redirect(`/account?error=${encodeURIComponent(m.status_access_help({}, { locale }))}`);
  }

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
    return redirect(
      `/account?error=${encodeURIComponent(m.account_save_failed({}, { locale }))}`,
    );
  }
  return redirect("/account?saved=profile");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
