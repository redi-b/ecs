import { saveStoreCustomerAddress } from "./account.js";
import { isStoreError } from "./result.js";
import { getCustomerTokenFromRequest } from "../session/customer-cookie.js";

type CheckoutAddressContext = {
  platformApiBaseUrl: string;
  requestHost: string | null;
};

export async function saveCheckoutAddressIfRequested(
  request: Request,
  form: FormData,
  context: CheckoutAddressContext,
) {
  if (
    form.get("deliveryChoice") !== "delivery" ||
    form.get("saveAddress") !== "true" ||
    String(form.get("savedAddressId") ?? "").trim()
  ) {
    return { ok: true as const };
  }

  const token = getCustomerTokenFromRequest(request);
  if (!token) return { ok: true as const };

  const result = await saveStoreCustomerAddress({
    platformApiBaseUrl: context.platformApiBaseUrl,
    requestHost: context.requestHost ?? new URL(request.url).host,
    token,
    address: {
      addressName: String(form.get("addressName") ?? "Home").trim() || "Home",
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      address1: String(form.get("address1") ?? "").trim(),
      address2: "",
      city: String(form.get("city") ?? "").trim(),
      province: "",
      postalCode: "",
      countryCode: "et",
      isDefaultShipping: form.get("makeDefaultAddress") === "true",
    },
  });

  return isStoreError(result)
    ? { ok: false as const, message: result.message }
    : { ok: true as const };
}
