import {
  settlementToMetadata,
  type OrderSettlementInput,
} from "../../../lib/settlement.js";
import type { MerchantOrder, MerchantOrderActionResult } from "../../../types/index.js";
import {
  deliverMerchantOrderFulfillment,
  fulfillMerchantOrder,
  getMerchantOrderForAction,
} from "./actions.js";
import { getAdminHeaders, requestMedusa } from "./medusa-http.js";
import { getFulfillmentItems, normalizeOrder } from "./normalize.js";
import { getOrderActionUrl, getOrderUrl, normalizeBaseUrl } from "./urls.js";
import { getString, isRecord } from "./values.js";

type MedusaOptions = {
  adminApiToken?: string | undefined;
  medusaInternalUrl: string;
};

type Fetcher = typeof fetch;

function isPaidStatus(value: string | null | undefined) {
  const key = value?.trim().toLowerCase() ?? "";
  return key.includes("captured") || key === "paid" || key.includes("refund");
}

function isCanceledOrder(order: MerchantOrder) {
  return (order.status ?? "").toLowerCase().includes("cancel");
}

function isCompletedOrder(order: MerchantOrder) {
  const status = (order.status ?? "").toLowerCase();
  const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();
  return status.includes("complete") || fulfillment.includes("deliver");
}

function isReadyOrder(order: MerchantOrder) {
  if (isCanceledOrder(order) || isCompletedOrder(order)) return false;
  const fulfillment = (order.fulfillmentStatus ?? "").toLowerCase();
  if (fulfillment === "not_fulfilled" || fulfillment.startsWith("not_")) return false;
  return (
    fulfillment === "fulfilled" ||
    fulfillment === "partially_fulfilled" ||
    fulfillment.includes("ship") ||
    fulfillment.startsWith("fulfill")
  );
}

async function fetchRawOrder(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: { orderId: string; salesChannelId: string },
) {
  const response = await requestMedusa(fetcher, getOrderUrl(options.medusaInternalUrl, input), {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  const data = await response.json().catch(() => undefined);
  const raw = isRecord(data) && isRecord(data.order) ? data.order : null;
  if (!raw) {
    return { ok: false as const, status: 404 };
  }

  const channelId = getString(raw.sales_channel_id);
  if (channelId && channelId !== input.salesChannelId) {
    return { ok: false as const, status: 404 };
  }

  return { ok: true as const, raw };
}

function getPaymentCollections(raw: Record<string, unknown>) {
  if (Array.isArray(raw.payment_collections)) {
    return raw.payment_collections.filter(isRecord);
  }
  if (isRecord(raw.payment_collection)) {
    return [raw.payment_collection];
  }
  return [];
}

function getPaymentCollectionIds(raw: Record<string, unknown>) {
  return getPaymentCollections(raw)
    .map((collection) => getString(collection.id))
    .filter((id): id is string => Boolean(id));
}

function getPaymentIds(raw: Record<string, unknown>) {
  const ids: string[] = [];
  for (const collection of getPaymentCollections(raw)) {
    const payments = Array.isArray(collection.payments) ? collection.payments : [];
    for (const payment of payments) {
      if (!isRecord(payment)) continue;
      const id = getString(payment.id);
      if (id) ids.push(id);
    }
  }
  return ids;
}

function orderContainsTxRef(raw: Record<string, unknown>, txRef: string) {
  const needle = txRef.trim().toLowerCase();
  if (!needle) return false;

  const metadata = isRecord(raw.metadata) ? raw.metadata : {};
  const metaRefs = [
    getString(metadata.tx_ref),
    getString(metadata.chapa_tx_ref),
    getString(metadata.payment_reference),
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  if (metaRefs.includes(needle)) return true;

  for (const collection of getPaymentCollections(raw)) {
    const sessions = Array.isArray(collection.payment_sessions)
      ? collection.payment_sessions
      : [];
    for (const session of sessions) {
      if (!isRecord(session)) continue;
      const data = isRecord(session.data) ? session.data : {};
      const refs = [
        getString(data.tx_ref),
        getString(data.txRef),
        getString(session.id),
        getString(data.reference),
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      if (refs.includes(needle)) return true;
    }
  }

  return false;
}

async function markPaymentCollectionsPaid(
  fetcher: Fetcher,
  options: MedusaOptions,
  collectionIds: string[],
) {
  let anyOk = false;

  for (const collectionId of collectionIds) {
    const url = new URL(
      `/admin/payment-collections/${encodeURIComponent(collectionId)}/mark-as-paid`,
      normalizeBaseUrl(options.medusaInternalUrl),
    );
    const response = await requestMedusa(fetcher, url, {
      body: JSON.stringify({}),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    });
    if (response.ok) {
      anyOk = true;
    }
  }

  return anyOk;
}

async function capturePayments(fetcher: Fetcher, options: MedusaOptions, paymentIds: string[]) {
  let anyOk = false;

  for (const paymentId of paymentIds) {
    const url = new URL(
      `/admin/payments/${encodeURIComponent(paymentId)}/capture`,
      normalizeBaseUrl(options.medusaInternalUrl),
    );
    const response = await requestMedusa(fetcher, url, {
      body: JSON.stringify({}),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    });
    if (response.ok) {
      anyOk = true;
    }
  }

  return anyOk;
}

async function patchOrderMetadata(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: {
    orderId: string;
    metadata: Record<string, unknown>;
  },
) {
  const url = new URL(
    `/admin/orders/${encodeURIComponent(input.orderId)}`,
    normalizeBaseUrl(options.medusaInternalUrl),
  );

  // Merge with existing metadata on Medusa side is not guaranteed — send full patch keys.
  const response = await requestMedusa(fetcher, url, {
    body: JSON.stringify({ metadata: input.metadata }),
    headers: getAdminHeaders(options.adminApiToken ?? ""),
    method: "POST",
  });

  return response.ok;
}

/** Update settlement labels on an already-paid (or unpaid) order without changing payment state. */
export async function updateMerchantOrderSettlement(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: {
    orderId: string;
    salesChannelId: string;
    settlement: OrderSettlementInput;
  },
): Promise<MerchantOrderActionResult> {
  const existing = await getMerchantOrderForAction(fetcher, options, input);
  if (!existing.ok) return existing;

  const rawResult = await fetchRawOrder(fetcher, options, input);
  if (!rawResult.ok) {
    return {
      ok: false,
      error: rawResult.status === 401 ? "commerce_credentials_invalid" : "order_not_found",
      status: rawResult.status === 401 ? 401 : 404,
    };
  }

  const existingMeta = isRecord(rawResult.raw.metadata) ? rawResult.raw.metadata : {};
  const nextMeta = {
    ...existingMeta,
    ...settlementToMetadata(input.settlement),
  };

  await patchOrderMetadata(fetcher, options, {
    orderId: input.orderId,
    metadata: nextMeta,
  });

  return getMerchantOrderForAction(fetcher, options, input);
}

/**
 * Mark an order as paid (COD operator action or Chapa override).
 * Prefers Medusa payment-collection mark-as-paid; falls back to metadata override.
 * Settlement (how money arrived) is required for dashboard/telegram; Chapa auto-sets method.
 */
export async function markMerchantOrderPaid(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: {
    orderId: string;
    salesChannelId: string;
    source?: "dashboard" | "chapa_webhook" | "chapa_recheck" | "telegram" | undefined;
    paymentReference?: string | null | undefined;
    settlement?: OrderSettlementInput | null | undefined;
  },
): Promise<MerchantOrderActionResult> {
  const existing = await getMerchantOrderForAction(fetcher, options, input);
  if (!existing.ok) {
    return existing;
  }

  if (isPaidStatus(existing.order.paymentStatus)) {
    return existing;
  }

  if (isCanceledOrder(existing.order)) {
    return {
      ok: false,
      error: "order_not_fulfillable",
      status: 409,
    };
  }

  const rawResult = await fetchRawOrder(fetcher, options, input);
  if (!rawResult.ok) {
    return {
      ok: false,
      error: rawResult.status === 401 ? "commerce_credentials_invalid" : "order_not_found",
      status: rawResult.status === 401 ? 401 : 404,
    };
  }

  const collectionIds = getPaymentCollectionIds(rawResult.raw);
  const paymentIds = getPaymentIds(rawResult.raw);

  let captured = false;
  if (paymentIds.length > 0) {
    captured = await capturePayments(fetcher, options, paymentIds);
  }
  if (!captured && collectionIds.length > 0) {
    captured = await markPaymentCollectionsPaid(fetcher, options, collectionIds);
  }

  const existingMeta = isRecord(rawResult.raw.metadata) ? rawResult.raw.metadata : {};
  const paidAt = new Date().toISOString();
  const isChapaSource =
    input.source === "chapa_webhook" || input.source === "chapa_recheck";

  const nextMeta: Record<string, unknown> = {
    ...existingMeta,
    payment_status_override: "paid",
    paid_via: input.source ?? "dashboard",
    paid_at: paidAt,
  };
  if (input.paymentReference) {
    nextMeta.payment_reference = input.paymentReference;
    nextMeta.tx_ref = input.paymentReference;
  }
  if (!getString(existingMeta.payment_method) && !getString(existingMeta.checkout_type)) {
    nextMeta.payment_method = isChapaSource ? "chapa" : "cod";
  }

  // Settlement: Chapa auto; dashboard/telegram require explicit method (caller validates).
  if (input.settlement?.method) {
    Object.assign(nextMeta, settlementToMetadata(input.settlement, paidAt));
  } else if (isChapaSource) {
    Object.assign(
      nextMeta,
      settlementToMetadata(
        {
          method: "chapa",
          reference: input.paymentReference ?? getString(existingMeta.tx_ref) ?? undefined,
        },
        paidAt,
      ),
    );
  }

  await patchOrderMetadata(fetcher, options, {
    orderId: input.orderId,
    metadata: nextMeta,
  });

  const refreshed = await getMerchantOrderForAction(fetcher, options, input);
  if (refreshed.ok) {
    // Ensure UI sees paid even if Medusa payment_status lags.
    if (!isPaidStatus(refreshed.order.paymentStatus)) {
      return {
        ok: true,
        order: {
          ...refreshed.order,
          paymentStatus: "captured",
        },
      };
    }
    return refreshed;
  }

  return {
    ok: true,
    order: {
      ...existing.order,
      paymentStatus: "captured",
      paymentReference: input.paymentReference ?? existing.order.paymentReference ?? null,
    },
  };
}

export async function capturePaymentByTxRef(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: {
    salesChannelId: string;
    source?: "chapa_webhook" | "chapa_recheck" | undefined;
    txRef: string;
  },
): Promise<MerchantOrderActionResult | { ok: false; error: "order_not_found"; status: 404 }> {
  const txRef = input.txRef.trim();
  if (!txRef) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  // Search recent tenant orders and match payment session / metadata tx_ref.
  const listUrl = new URL("/admin/orders", normalizeBaseUrl(options.medusaInternalUrl));
  listUrl.searchParams.set("limit", "50");
  listUrl.searchParams.set("offset", "0");
  listUrl.searchParams.set("order", "-created_at");
  listUrl.searchParams.append("sales_channel_id[]", input.salesChannelId);
  listUrl.searchParams.set("q", txRef);
  listUrl.searchParams.set(
    "fields",
    "id,sales_channel_id,payment_status,metadata,*payment_collections,*payment_collections.payment_sessions,*payment_collections.payments",
  );

  const listed = await requestMedusa(fetcher, listUrl, {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });

  let candidates: Record<string, unknown>[] = [];
  if (listed.ok) {
    const data = await listed.json().catch(() => undefined);
    if (Array.isArray(data?.orders)) {
      candidates = data.orders.filter(isRecord);
    }
  }

  // If q search misses session data, fall back to a recent channel window without q.
  if (candidates.length === 0) {
    const recentUrl = new URL("/admin/orders", normalizeBaseUrl(options.medusaInternalUrl));
    recentUrl.searchParams.set("limit", "100");
    recentUrl.searchParams.set("offset", "0");
    recentUrl.searchParams.set("order", "-created_at");
    recentUrl.searchParams.append("sales_channel_id[]", input.salesChannelId);
    recentUrl.searchParams.set(
      "fields",
      "id,sales_channel_id,payment_status,metadata,*payment_collections,*payment_collections.payment_sessions,*payment_collections.payments",
    );
    const recent = await requestMedusa(fetcher, recentUrl, {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
    });
    if (recent.ok) {
      const data = await recent.json().catch(() => undefined);
      if (Array.isArray(data?.orders)) {
        candidates = data.orders.filter(isRecord);
      }
    }
  }

  const match = candidates.find((order) => orderContainsTxRef(order, txRef));
  const orderId = match ? getString(match.id) : undefined;

  if (!orderId) {
    return { ok: false, error: "order_not_found", status: 404 };
  }

  return markMerchantOrderPaid(fetcher, options, {
    orderId,
    salesChannelId: input.salesChannelId,
    paymentReference: txRef,
    source: input.source ?? "chapa_webhook",
  });
}

export async function finishMerchantOrder(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: {
    markPaid?: boolean | undefined;
    orderId: string;
    salesChannelId: string;
    shippingOptionId?: string | undefined;
    stockLocationId?: string | undefined;
    settlement?: OrderSettlementInput | null | undefined;
  },
): Promise<MerchantOrderActionResult> {
  let current = await getMerchantOrderForAction(fetcher, options, input);
  if (!current.ok) {
    return current;
  }

  if (isCanceledOrder(current.order)) {
    return {
      ok: false,
      error: "order_not_fulfillable",
      status: 409,
    };
  }

  // 1) Pack if needed
  if (!isReadyOrder(current.order) && !isCompletedOrder(current.order)) {
    if (getFulfillmentItems(current.order).length > 0) {
      const fulfilled = await fulfillMerchantOrder(fetcher, options, {
        order: current.order,
        orderId: input.orderId,
        salesChannelId: input.salesChannelId,
        shippingOptionId: input.shippingOptionId,
        stockLocationId: input.stockLocationId,
      });
      if (!fulfilled.ok) {
        return fulfilled;
      }
      current = fulfilled;
    }
  }

  // 2) Deliver open fulfillments if not completed
  if (!isCompletedOrder(current.order)) {
    const openFulfillments = (current.order.fulfillments ?? []).filter(
      (fulfillment) => !fulfillment.deliveredAt && !fulfillment.canceledAt,
    );

    for (const fulfillment of openFulfillments) {
      const delivered = await deliverMerchantOrderFulfillment(fetcher, options, {
        fulfillmentId: fulfillment.id,
        order: current.order,
        orderId: input.orderId,
        salesChannelId: input.salesChannelId,
      });
      if (!delivered.ok) {
        return delivered;
      }
      current = delivered;
    }
  }

  // 3) Optional mark paid (COD) — default settlement cash when finish bundles paid
  if (input.markPaid && !isPaidStatus(current.order.paymentStatus)) {
    const paid = await markMerchantOrderPaid(fetcher, options, {
      orderId: input.orderId,
      salesChannelId: input.salesChannelId,
      source: "dashboard",
      settlement: input.settlement ?? { method: "cash" },
    });
    if (!paid.ok) {
      return paid;
    }
    current = paid;
  }

  // 4) Complete order if still open
  if (!isCompletedOrder(current.order) || !(current.order.status ?? "").toLowerCase().includes("complete")) {
    const status = (current.order.status ?? "").toLowerCase();
    if (!status.includes("complete") && !status.includes("cancel")) {
      const response = await requestMedusa(
        fetcher,
        getOrderActionUrl(options.medusaInternalUrl, {
          action: "complete",
          orderId: input.orderId,
        }),
        {
          body: JSON.stringify({}),
          headers: getAdminHeaders(options.adminApiToken ?? ""),
          method: "POST",
        },
      );

      if (response.status === 401) {
        return { ok: false, error: "commerce_credentials_invalid", status: 401 };
      }
      if (!response.ok && response.status !== 409) {
        // 409 may mean already completed — try refresh
        if (response.status === 404) {
          return { ok: false, error: "order_not_found", status: 404 };
        }
        // If complete fails but deliver succeeded, still refresh
      }

      const refreshed = await getMerchantOrderForAction(fetcher, options, input);
      if (refreshed.ok) {
        return refreshed;
      }
    }
  }

  return current;
}

export async function findOrderIdByTxRef(
  fetcher: Fetcher,
  options: MedusaOptions,
  input: { salesChannelId: string; txRef: string },
) {
  const result = await capturePaymentByTxRef(fetcher, options, {
    ...input,
    source: "chapa_recheck",
  });
  return result;
}
