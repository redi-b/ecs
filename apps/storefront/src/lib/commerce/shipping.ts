import { asError, isRecord, storeFetch } from "./http.js";
import { normalizeShippingOption } from "./normalize.js";
import type {
  HostedStoreRequest,
  StorefrontError,
  StoreShippingOption,
  StoreShippingOptionsResponse,
} from "./types.js";

export async function listStoreShippingOptions(
  options: HostedStoreRequest & { cartId: string },
): Promise<StoreShippingOptionsResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/shipping-options",
    searchParams: {
      cart_id: options.cartId,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const raw = isRecord(data)
    ? (data.shipping_options ?? data.shippingOptions ?? data)
    : undefined;
  const list = Array.isArray(raw) ? raw : [];

  return {
    shippingOptions: list
      .map(normalizeShippingOption)
      .filter((option): option is StoreShippingOption => Boolean(option)),
  };
}

export async function setStoreCartShippingMethod(
  options: HostedStoreRequest & {
    cartId: string;
    shippingOptionId: string;
    data?: Record<string, unknown>;
  },
) {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}/shipping-methods`,
    method: "POST",
    body: {
      option_id: options.shippingOptionId,
      data: options.data ?? {},
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return { ok: true as const, data };
}
