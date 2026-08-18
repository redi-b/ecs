import type { APIRoute } from "astro";

import {
  deleteStoreCustomerAddress,
  saveStoreCustomerAddress,
} from "../../../lib/commerce/account.js";
import { getPlatformApiBaseUrl, getRequestHost } from "../../../lib/env.js";
import { getCustomerTokenFromRequest } from "../../../lib/session/customer-cookie.js";

export const POST: APIRoute = async ({ request }) => {
  const token = getCustomerTokenFromRequest(request);
  if (!token) return redirect("/account?error=Sign%20in%20to%20manage%20saved%20addresses.");

  const form = await request.formData();
  const addressId = String(form.get("addressId") ?? "").trim();
  const intent = String(form.get("intent") ?? "save");
  const common = {
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: getRequestHost(request),
    token,
  };

  if (intent === "delete") {
    if (!addressId) return redirect("/account?error=Saved%20address%20not%20found.");
    const result = await deleteStoreCustomerAddress({ ...common, addressId });
    return result === true
      ? redirect("/account?saved=address-removed#saved-addresses")
      : redirect(`/account?error=${encodeURIComponent(result.message)}#saved-addresses`);
  }

  const result = await saveStoreCustomerAddress({
    ...common,
    ...(addressId ? { addressId } : {}),
    address: {
      addressName: String(form.get("addressName") ?? "").trim(),
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      address1: String(form.get("address1") ?? "").trim(),
      address2: String(form.get("address2") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      province: String(form.get("province") ?? "").trim(),
      postalCode: String(form.get("postalCode") ?? "").trim(),
      countryCode: "et",
      isDefaultShipping: form.get("isDefaultShipping") === "on",
    },
  });

  return "ok" in result
    ? redirect(`/account?error=${encodeURIComponent(result.message)}#saved-addresses`)
    : redirect("/account?saved=address#saved-addresses");
};

function redirect(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
