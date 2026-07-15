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
};

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
  if (order.sales_channel_id) {
    payload.medusaSalesChannelId = order.sales_channel_id;
  }
  return payload;
}
