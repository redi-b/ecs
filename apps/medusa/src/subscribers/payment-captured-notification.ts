import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { loadOrderForNotification } from "../lib/load-order-for-notification";
import {
  buildOrderNotificationPayload,
  emitPlatformNotificationEvent,
  medusaToPlatformNotificationEvent,
} from "../lib/platform-notifications";

type PaymentCapturedData = {
  id?: string;
};

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

async function resolveOrderIdFromPayment(
  query: QueryGraph,
  paymentId: string,
): Promise<string | null> {
  const { data } = await query.graph({
    entity: "payment",
    fields: ["id", "payment_collection_id", "payment_collection.order.id"],
    filters: { id: paymentId },
  });

  const [row] = data;
  if (!row || typeof row !== "object") {
    return null;
  }

  const payment = row as {
    payment_collection?: { order?: { id?: string } | null } | null;
  };
  const orderId = payment.payment_collection?.order?.id;
  return typeof orderId === "string" && orderId ? orderId : null;
}

/**
 * payment.captured → platform payment.paid.
 * Event payload is `{ id }` (payment id); we resolve the order via Query.
 */
export default async function paymentCapturedNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<PaymentCapturedData>) {
  const logger = container.resolve("logger");
  const query = container.resolve("query") as QueryGraph;

  const paymentId = data?.id;
  if (!paymentId) {
    logger.warn("payment.captured notification skipped: missing payment id");
    return;
  }

  try {
    const orderId = await resolveOrderIdFromPayment(query, paymentId);
    if (!orderId) {
      logger.warn(
        { paymentId },
        "payment.captured notification skipped: could not resolve order from payment",
      );
      return;
    }

    const order = await loadOrderForNotification(query, orderId);
    if (!order?.sales_channel_id) {
      logger.warn(
        { orderId, paymentId },
        "payment.captured notification skipped: order or sales_channel_id missing",
      );
      return;
    }

    const eventType = medusaToPlatformNotificationEvent["payment.captured"] ?? "payment.paid";
    const result = await emitPlatformNotificationEvent({
      eventType,
      medusaSalesChannelId: order.sales_channel_id,
      sourceEventId: `payment.captured:${paymentId}`,
      payload: {
        ...buildOrderNotificationPayload(order),
        paymentId,
      },
    });

    if (!result.ok) {
      logger.error(
        { orderId, paymentId, error: result.error, status: result.status },
        "failed to emit platform notification for payment.captured",
      );
      return;
    }

    logger.info(
      { orderId, paymentId, eventType },
      "emitted platform notification for payment.captured",
    );
  } catch (error) {
    logger.error(
      { paymentId, err: error instanceof Error ? error.message : String(error) },
      "payment.captured notification handler error",
    );
  }
}

export const config: SubscriberConfig = {
  event: "payment.captured",
};
