export type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

export type LoadedOrderForNotification = {
  id: string;
  display_id?: number | string | null;
  custom_display_id?: string | null;
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
  created_at?: string | null;
  items: Array<{
    id?: string;
    quantity?: number | null;
    variant_id?: string | null;
    unit_cost_amount?: number | null;
  }> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeLoadedOrder(row: unknown): LoadedOrderForNotification | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id) return null;

  const shipping = asRecord(raw.shipping_address);
  const metadata = asRecord(raw.metadata);
  const items: LoadedOrderForNotification["items"] = Array.isArray(raw.items)
    ? raw.items.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const next: NonNullable<LoadedOrderForNotification["items"]>[number] = {};
        if (typeof item.id === "string") next.id = item.id;
        if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
          next.quantity = item.quantity;
        } else if (item.quantity === null) {
          next.quantity = null;
        }
        next.variant_id = typeof item.variant_id === "string" ? item.variant_id : null;
        const variant = asRecord(item.variant);
        const variantMetadata = asRecord(variant?.metadata);
        const cost = variantMetadata?.ecs_unit_cost_amount;
        const currency = variantMetadata?.ecs_unit_cost_currency;
        next.unit_cost_amount =
          typeof cost === "number" && Number.isInteger(cost) && cost >= 0 && currency === "etb"
            ? cost
            : null;
        return [next];
      })
    : null;

  return {
    id: raw.id,
    display_id:
      typeof raw.display_id === "number" || typeof raw.display_id === "string"
        ? raw.display_id
        : null,
    custom_display_id: typeof raw.custom_display_id === "string" ? raw.custom_display_id : null,
    currency_code: typeof raw.currency_code === "string" ? raw.currency_code : null,
    total: typeof raw.total === "number" || typeof raw.total === "string" ? raw.total : null,
    email: typeof raw.email === "string" ? raw.email : null,
    sales_channel_id: typeof raw.sales_channel_id === "string" ? raw.sales_channel_id : null,
    status: typeof raw.status === "string" ? raw.status : null,
    payment_status: typeof raw.payment_status === "string" ? raw.payment_status : null,
    metadata,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    shipping_address: shipping
      ? {
          first_name: typeof shipping.first_name === "string" ? shipping.first_name : null,
          last_name: typeof shipping.last_name === "string" ? shipping.last_name : null,
          phone: typeof shipping.phone === "string" ? shipping.phone : null,
          city: typeof shipping.city === "string" ? shipping.city : null,
        }
      : null,
    items,
  };
}

const ORDER_NOTIFICATION_FIELDS = [
  "id",
  "display_id",
  "custom_display_id",
  "currency_code",
  "total",
  "email",
  "sales_channel_id",
  "status",
  "payment_status",
  "metadata",
  "created_at",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.city",
  "items.id",
  "items.quantity",
  "items.variant_id",
  "items.variant.metadata",
] as const;

export async function loadOrderForNotification(
  query: QueryGraph,
  orderId: string,
): Promise<LoadedOrderForNotification | null> {
  const { data } = await query.graph({
    entity: "order",
    fields: [...ORDER_NOTIFICATION_FIELDS],
    filters: { id: orderId },
  });

  return normalizeLoadedOrder(data[0]);
}

export async function loadOrderForFulfillmentNotification(
  query: QueryGraph,
  fulfillmentId: string,
): Promise<LoadedOrderForNotification | null> {
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ORDER_NOTIFICATION_FIELDS.map((field) => `order.${field}`),
    filters: { id: fulfillmentId },
  });
  const fulfillment = asRecord(data[0]);
  return normalizeLoadedOrder(fulfillment?.order);
}
