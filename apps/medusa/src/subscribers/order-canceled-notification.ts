import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { loadOrderForNotification } from "../lib/load-order-for-notification";
import {
  buildOrderNotificationPayload,
  emitPlatformNotificationEvent,
  medusaToPlatformNotificationEvent,
} from "../lib/platform-notifications";

export default async function orderCanceledNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  const query = container.resolve("query");

  const orderId = data?.id;
  if (!orderId) {
    logger.warn("order.canceled notification skipped: missing order id");
    return;
  }

  try {
    const order = await loadOrderForNotification(query, orderId);
    if (!order?.sales_channel_id) {
      logger.warn(
        { orderId },
        "order.canceled notification skipped: order or sales_channel_id missing",
      );
      return;
    }

    const eventType = medusaToPlatformNotificationEvent["order.canceled"] ?? "order.cancelled";
    const result = await emitPlatformNotificationEvent({
      eventType,
      medusaSalesChannelId: order.sales_channel_id,
      sourceEventId: `order.canceled:${order.id}`,
      payload: buildOrderNotificationPayload(order),
    });

    if (!result.ok) {
      logger.error(
        { orderId, error: result.error, status: result.status },
        "failed to emit platform notification for order.canceled",
      );
      return;
    }

    logger.info({ orderId, eventType }, "emitted platform notification for order.canceled");
  } catch (error) {
    logger.error(
      { orderId, err: error instanceof Error ? error.message : String(error) },
      "order.canceled notification handler error",
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
