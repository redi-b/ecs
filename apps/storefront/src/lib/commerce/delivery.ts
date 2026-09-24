import { asError, isRecord, storeFetch } from "./http.js";
import { normalizeDeliveryOptions } from "./normalize.js";
import type { HostedStoreRequest, StoreDeliveryOptionsResponse, StorefrontError } from "./types.js";

export async function getStoreDeliveryOptions(
  options: HostedStoreRequest,
): Promise<StoreDeliveryOptionsResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/delivery",
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    delivery: normalizeDeliveryOptions(isRecord(data) ? data.delivery : undefined),
  };
}
