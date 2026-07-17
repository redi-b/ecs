import { asError, getBoolean, isRecord, storeFetch } from "./http.js";
import { normalizeCompletedOrder } from "./normalize.js";
import type {
  ChapaCheckoutResponse,
  CodCheckoutInput,
  CodCheckoutResponse,
  HostedStoreRequest,
  StorefrontError,
  StorePaymentOptions,
} from "./types.js";

export async function getStorePaymentOptions(
  options: HostedStoreRequest,
): Promise<{ payment: StorePaymentOptions } | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/payment-options",
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    // Older platform without this route: COD only.
    if (response.status === 404) {
      return { payment: { cod: true, chapa: false } };
    }
    return asError(response.status, data, response.statusText);
  }

  const payment = isRecord(data) ? data.payment : undefined;
  return {
    payment: {
      cod: isRecord(payment) ? getBoolean(payment.cod) || payment.cod !== false : true,
      chapa: isRecord(payment) ? getBoolean(payment.chapa) : false,
    },
  };
}

export async function completeCodCheckout(
  options: HostedStoreRequest & { input: CodCheckoutInput },
): Promise<CodCheckoutResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/checkout/cod",
    method: "POST",
    body: options.input,
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const order = normalizeCompletedOrder(data);
  if (!order) {
    return { ok: false, status: 502, message: "order_missing_from_checkout_response" };
  }

  return { order };
}

export async function initializeChapaCheckout(
  options: HostedStoreRequest & {
    cartId: string;
    returnUrl: string;
  },
): Promise<ChapaCheckoutResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/checkout/chapa",
    method: "POST",
    body: {
      cartId: options.cartId,
      returnUrl: options.returnUrl,
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const checkoutUrl = isRecord(data) && typeof data.checkoutUrl === "string" ? data.checkoutUrl : null;
  if (!checkoutUrl) {
    return { ok: false, status: 502, message: "chapa_checkout_url_unavailable" };
  }

  const paymentSessionId =
    isRecord(data) && isRecord(data.paymentSession) && typeof data.paymentSession.id === "string"
      ? data.paymentSession.id
      : null;

  return {
    checkoutUrl,
    paymentSessionId,
  };
}

export async function completeStoreCart(
  options: HostedStoreRequest & { cartId: string },
): Promise<CodCheckoutResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: `/store/carts/${encodeURIComponent(options.cartId)}/complete`,
    method: "POST",
    body: {},
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const order = normalizeCompletedOrder(data);
  if (!order) {
    return { ok: false, status: 502, message: "order_missing_from_complete_response" };
  }

  return { order };
}

/**
 * Verify merchant Chapa payment then complete cart (platform-owned).
 * Prefer this over bare cart complete after Chapa redirect.
 */
export async function completeChapaStoreCheckout(
  options: HostedStoreRequest & {
    cartId: string;
    txRef?: string | null;
  },
): Promise<CodCheckoutResponse | StorefrontError> {
  const response = await storeFetch({
    ...options,
    path: "/store/checkout/chapa/complete",
    method: "POST",
    body: {
      cartId: options.cartId,
      ...(options.txRef ? { txRef: options.txRef } : {}),
    },
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return asError(response.status, data, response.statusText);
  }

  const order = normalizeCompletedOrder(data);
  if (!order) {
    return { ok: false, status: 502, message: "order_missing_from_checkout_response" };
  }

  return { order };
}
