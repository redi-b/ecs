import type {
  MerchantOrderReturn,
  MerchantOrderReturnResult,
} from "../../../types/index.js";
import { mapMedusaFailure } from "../map-medusa-failure.js";
import { getAdminHeaders, requestMedusa } from "./medusa-http.js";
import { normalizeOrder } from "./normalize.js";
import {
  getOrderUrl,
  getReturnConfirmRequestUrl,
  getReturnRequestItemsUrl,
  getReturnsUrl,
} from "./urls.js";
import { getNumber, getString, isRecord } from "./values.js";

export type MerchantReturnInput = {
  orderId: string;
  salesChannelId: string;
  locationId?: string | undefined;
  note?: string | null | undefined;
  items: Array<{
    lineItemId: string;
    quantity: number;
    reasonId?: string | null | undefined;
    note?: string | null | undefined;
  }>;
};

export function normalizeReturn(value: unknown): MerchantOrderReturn | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  if (!id) return null;
  const items = Array.isArray(value.items)
    ? value.items.flatMap((item): MerchantOrderReturn["items"] => {
        if (!isRecord(item)) return [];
        const itemId = getString(item.id);
        const lineItemId = getString(item.item_id);
        const quantity = getNumber(item.quantity);
        if (!itemId || !lineItemId || quantity == null) return [];
        return [{
          id: itemId,
          lineItemId,
          quantity,
          receivedQuantity: getNumber(item.received_quantity) ?? 0,
          damagedQuantity: getNumber(item.damaged_quantity) ?? 0,
          reasonId: getString(item.reason_id),
          note: getString(item.note),
        }];
      })
    : [];
  return {
    id,
    status: getString(value.status),
    locationId: getString(value.location_id),
    items,
    requestedAt: getString(value.requested_at),
    receivedAt: getString(value.received_at),
    canceledAt: getString(value.canceled_at),
    createdAt: getString(value.created_at),
  };
}

export function getOrderReturns(value: unknown): MerchantOrderReturn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const normalized = normalizeReturn(item);
    return normalized ? [normalized] : [];
  });
}

export async function createMerchantReturn(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  input: MerchantReturnInput,
): Promise<MerchantOrderReturnResult> {
  if (
    input.items.length === 0 ||
    input.items.some(
      (item) => !item.lineItemId.trim() || !Number.isInteger(item.quantity) || item.quantity <= 0,
    )
  ) {
    return { ok: false, error: "order_return_invalid", status: 400 };
  }

  const headers = getAdminHeaders(options.adminApiToken ?? "");
  const orderResponse = await requestMedusa(fetcher, getOrderUrl(options.medusaInternalUrl, input), {
    headers,
  });
  if (!orderResponse.ok) {
    return (await mapMedusaFailure(orderResponse)) as Extract<
      MerchantOrderReturnResult,
      { ok: false }
    >;
  }
  const orderData = await orderResponse.json().catch(() => undefined);
  const order = normalizeOrder(orderData?.order, input.salesChannelId)[0];
  if (!order) return { ok: false, error: "order_not_found", status: 404 };
  if (!(order.fulfillmentStatus ?? "").toLowerCase().includes("deliver")) {
    return { ok: false, error: "order_not_returnable", status: 409 };
  }
  const quantities = new Map((order.items ?? []).map((item) => [item.id, item.quantity ?? 0]));
  if (input.items.some((item) => (quantities.get(item.lineItemId) ?? 0) < item.quantity)) {
    return { ok: false, error: "order_return_invalid", status: 409 };
  }

  const begin = await requestMedusa(fetcher, getReturnsUrl(options.medusaInternalUrl), {
    body: JSON.stringify({
      order_id: input.orderId,
      ...(input.locationId ? { location_id: input.locationId } : {}),
      ...(input.note?.trim() ? { internal_note: input.note.trim() } : {}),
      no_notification: true,
    }),
    headers,
    method: "POST",
  });
  if (!begin.ok) return mapReturnFailure(begin);
  const beginData = await begin.json().catch(() => undefined);
  const returnId = getString(beginData?.return?.id);
  if (!returnId) return { ok: false, error: "commerce_backend_error", status: 502 };

  const requested = await requestMedusa(
    fetcher,
    getReturnRequestItemsUrl(options.medusaInternalUrl, returnId),
    {
      body: JSON.stringify({
        items: input.items.map((item) => ({
          id: item.lineItemId,
          quantity: item.quantity,
          ...(item.reasonId ? { reason_id: item.reasonId } : {}),
          ...(item.note?.trim() ? { internal_note: item.note.trim() } : {}),
        })),
      }),
      headers,
      method: "POST",
    },
  );
  if (!requested.ok) return mapReturnFailure(requested);

  const confirmed = await requestMedusa(
    fetcher,
    getReturnConfirmRequestUrl(options.medusaInternalUrl, returnId),
    { body: JSON.stringify({ no_notification: true }), headers, method: "POST" },
  );
  if (!confirmed.ok) return mapReturnFailure(confirmed);
  const confirmedData = await confirmed.json().catch(() => undefined);
  const orderReturn = normalizeReturn(confirmedData?.return);
  return orderReturn
    ? { ok: true, orderReturn }
    : { ok: false, error: "commerce_backend_error", status: 502 };
}

async function mapReturnFailure(response: Response): Promise<MerchantOrderReturnResult> {
  return (await mapMedusaFailure(response, {
    invalidError: "order_return_invalid",
  })) as MerchantOrderReturnResult;
}
