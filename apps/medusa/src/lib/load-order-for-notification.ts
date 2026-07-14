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
};

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
    ],
    filters: { id: orderId },
  });

  const [row] = data;
  if (!row || typeof row !== "object") {
    return null;
  }

  const order = row as LoadedOrderForNotification;
  if (!order.id) {
    return null;
  }
  return order;
}
