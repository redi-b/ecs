import { asError, isRecord, storeFetch } from "./http.js";
import { normalizeCart } from "./normalize.js";
import { isStoreError } from "./result.js";
import type { HostedStoreRequest, StoreCartResponse, StorefrontError } from "./types.js";

export async function createStoreCart(
  options: HostedStoreRequest & { regionId?: string | null },
): Promise<StoreCartResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/carts",
    method: "POST",
    body: options.regionId ? { region_id: options.regionId } : {},
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    cart: normalizeCart(isRecord(data) ? data.cart : undefined),
  };
}

export async function getStoreCart(
  options: HostedStoreRequest & { cartId: string },
): Promise<StoreCartResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}`,
    searchParams: {
      fields: "*items,*items.variant,*items.product,+items.total,+items.unit_price,+total,+item_total,+shipping_total,+currency_code",
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    cart: normalizeCart(isRecord(data) ? data.cart : undefined),
  };
}

export async function updateStoreCart(
  options: HostedStoreRequest & {
    cartId: string;
    body: Record<string, unknown>;
  },
): Promise<StoreCartResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}`,
    method: "POST",
    body: options.body,
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    cart: normalizeCart(isRecord(data) ? data.cart : undefined),
  };
}

export async function addStoreCartLineItem(
  options: HostedStoreRequest & {
    cartId: string;
    variantId: string;
    quantity: number;
  },
): Promise<StoreCartResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}/line-items`,
    method: "POST",
    body: {
      variant_id: options.variantId,
      quantity: options.quantity,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    cart: normalizeCart(isRecord(data) ? data.cart : undefined),
  };
}

export async function updateStoreCartLineItem(
  options: HostedStoreRequest & {
    cartId: string;
    lineItemId: string;
    quantity: number;
  },
): Promise<StoreCartResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}/line-items/${encodeURIComponent(options.lineItemId)}`,
    method: "POST",
    body: {
      quantity: options.quantity,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  return {
    cart: normalizeCart(isRecord(data) ? data.cart : undefined),
  };
}

export async function removeStoreCartLineItem(
  options: HostedStoreRequest & {
    cartId: string;
    lineItemId: string;
  },
): Promise<StoreCartResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}/line-items/${encodeURIComponent(options.lineItemId)}`,
    method: "DELETE",
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  // Medusa delete may return parent cart or empty body.
  if (isRecord(data) && data.cart) {
    return { cart: normalizeCart(data.cart) };
  }

  return getStoreCart(options);
}

export async function ensureStoreCart(
  options: HostedStoreRequest & {
    cartId?: string | null;
    regionId: string;
  },
): Promise<StoreCartResponse | StorefrontError> {
  if (options.cartId) {
    const existing = await getStoreCart({ ...options, cartId: options.cartId });
    if (!isStoreError(existing) && existing.cart.id) {
      return existing;
    }
  }

  return createStoreCart({ ...options, regionId: options.regionId });
}
