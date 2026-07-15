export type PlatformNotificationEmitInput = {
  eventType: string;
  medusaSalesChannelId: string;
  payload?: Record<string, unknown>;
  sourceEventId?: string;
};

export type PlatformNotificationEmitResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; error: string; status?: number };

function getPlatformApiBaseUrl() {
  return (
    process.env.PLATFORM_API_INTERNAL_URL?.trim() ||
    process.env.PLATFORM_API_BASE_URL?.trim() ||
    "http://localhost:3000"
  );
}

function getInternalToken() {
  return (
    process.env.PLATFORM_INTERNAL_API_TOKEN?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "development-platform-internal-token")
  );
}

/**
 * Emit a normalized notification event to Platform API.
 * Failures are returned (callers should log, not crash the Medusa request path).
 */
export async function emitPlatformNotificationEvent(
  input: PlatformNotificationEmitInput,
  options?: { fetchImpl?: typeof fetch },
): Promise<PlatformNotificationEmitResult> {
  const token = getInternalToken();
  if (!token) {
    return { ok: false, error: "platform_internal_token_missing" };
  }

  const salesChannelId = input.medusaSalesChannelId.trim();
  if (!salesChannelId) {
    return { ok: false, error: "sales_channel_id_required" };
  }

  const baseUrl = getPlatformApiBaseUrl().replace(/\/$/, "");
  const url = `${baseUrl}/platform/internal/notifications/events`;
  const fetchImpl = options?.fetchImpl ?? fetch;

  const body: Record<string, unknown> = {
    eventType: input.eventType,
    medusaSalesChannelId: salesChannelId,
    source: "medusa",
  };
  if (input.sourceEventId) {
    body.sourceEventId = input.sourceEventId;
  }
  if (input.payload) {
    body.payload = {
      source: "medusa",
      ...input.payload,
    };
  }

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-internal-token": token,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `platform_notification_http_${response.status}`,
        status: response.status,
      };
    }

    return { ok: true, status: response.status, body: parsed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Map Medusa workflow event names → platform notification event types. */
export const medusaToPlatformNotificationEvent: Record<string, string> = {
  "order.placed": "order.created",
  "order.canceled": "order.cancelled",
  "order.fulfillment_created": "order.out_for_delivery",
  "payment.captured": "payment.paid",
};

export type OrderNotificationFields = {
  id: string;
  display_id?: number | string | null;
  currency_code?: string | null;
  total?: number | string | null;
  email?: string | null;
  sales_channel_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  metadata?: Record<string, unknown> | null;
  shipping_address?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    city?: string | null;
  } | null;
  items?: Array<{ id?: string; quantity?: number | null }> | null;
};

function pickMetaString(metadata: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function buildOrderNotificationPayload(order: OrderNotificationFields) {
  const payload: Record<string, unknown> = {
    orderId: order.id,
    source: "medusa",
  };
  if (order.display_id != null) {
    // Numeric display id only — renderer formats as #N for merchants.
    payload.orderDisplayId = String(order.display_id);
  }
  if (order.currency_code) {
    payload.currencyCode = String(order.currency_code).toUpperCase();
  }
  if (order.total != null) {
    // Prefer a clean numeric string; avoid float noise where possible.
    const asNumber = typeof order.total === "number" ? order.total : Number(order.total);
    payload.amount = Number.isFinite(asNumber) ? String(asNumber) : String(order.total);
  }
  if (order.email) {
    payload.customerEmail = order.email;
  }
  if (order.status) {
    payload.orderStatus = order.status;
  }
  if (order.payment_status) {
    payload.paymentStatus = order.payment_status;
  }
  if (order.sales_channel_id) {
    payload.medusaSalesChannelId = order.sales_channel_id;
  }

  const shipping = order.shipping_address;
  const name = [shipping?.first_name, shipping?.last_name].filter(Boolean).join(" ").trim();
  if (name) {
    payload.customerName = name;
  }
  const phone =
    shipping?.phone?.trim() ||
    pickMetaString(order.metadata, "customer_phone", "phone", "customerPhone");
  if (phone) {
    payload.customerPhone = phone;
  }
  if (shipping?.city?.trim()) {
    payload.customerCity = shipping.city.trim();
  }

  const deliveryChoice = pickMetaString(
    order.metadata,
    "delivery_choice",
    "deliveryChoice",
    "fulfillment_type",
  );
  if (deliveryChoice) {
    payload.deliveryChoice = deliveryChoice;
  }

  const paymentMethod = pickMetaString(
    order.metadata,
    "payment_method",
    "paymentMethod",
    "checkout_type",
  );
  if (paymentMethod) {
    payload.paymentMethod = paymentMethod;
  }

  if (Array.isArray(order.items) && order.items.length > 0) {
    const itemCount = order.items.reduce((sum, item) => {
      const qty = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
      return sum + qty;
    }, 0);
    payload.itemCount = itemCount;
  }

  return payload;
}
