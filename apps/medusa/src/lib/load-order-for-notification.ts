type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

export type LoadedOrderForNotification = {
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
  items: Array<{ id?: string; quantity?: number | null }> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export async function loadOrderForNotification(
  query: QueryGraph,
  orderId: string,
): Promise<LoadedOrderForNotification | null> {
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "currency_code",
      "total",
      "email",
      "sales_channel_id",
      "status",
      "payment_status",
      "metadata",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.phone",
      "shipping_address.city",
      "items.id",
      "items.quantity",
    ],
    filters: { id: orderId },
  });

  const [row] = data;
  if (!row || typeof row !== "object") {
    return null;
  }

  const raw = row as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id) {
    return null;
  }

  const shipping = asRecord(raw.shipping_address);
  const metadata = asRecord(raw.metadata);
  const items: Array<{ id?: string; quantity?: number | null }> | null = Array.isArray(
    raw.items,
  )
    ? raw.items.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const next: { id?: string; quantity?: number | null } = {};
        if (typeof item.id === "string") next.id = item.id;
        if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
          next.quantity = item.quantity;
        } else if (item.quantity === null) {
          next.quantity = null;
        }
        return [next];
      })
    : null;

  return {
    id: raw.id,
    display_id:
      typeof raw.display_id === "number" || typeof raw.display_id === "string"
        ? raw.display_id
        : null,
    currency_code: typeof raw.currency_code === "string" ? raw.currency_code : null,
    total:
      typeof raw.total === "number" || typeof raw.total === "string" ? raw.total : null,
    email: typeof raw.email === "string" ? raw.email : null,
    sales_channel_id: typeof raw.sales_channel_id === "string" ? raw.sales_channel_id : null,
    status: typeof raw.status === "string" ? raw.status : null,
    payment_status: typeof raw.payment_status === "string" ? raw.payment_status : null,
    metadata,
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
