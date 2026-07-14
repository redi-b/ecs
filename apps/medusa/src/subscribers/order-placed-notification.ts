import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { loadOrderForNotification } from "../lib/load-order-for-notification";
import {
  buildOrderNotificationPayload,
  emitPlatformNotificationEvent,
  medusaToPlatformNotificationEvent,
} from "../lib/platform-notifications";

/**
 * order.placed → platform order.created notification (log provider until real channels ship).
 */
export default async function orderPlacedNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger");
  const query = container.resolve("query");

  const orderId = data?.id;
  if (!orderId) {
    logger.warn("order.placed notification skipped: missing order id");
    return;
  }

  try {
    const order = await loadOrderForNotification(query, orderId);
    if (!order?.sales_channel_id) {
      logger.warn(
        `order.placed notification skipped: order or sales_channel_id missing (orderId=${orderId})`,
      );
      return;
    }

    const eventType = medusaToPlatformNotificationEvent["order.placed"] ?? "order.created";
    const result = await emitPlatformNotificationEvent({
      eventType,
      medusaSalesChannelId: order.sales_channel_id,
      sourceEventId: `order.placed:${order.id}`,
      payload: buildOrderNotificationPayload(order),
    });

    if (!result.ok) {
      logger.error(
        `failed to emit platform notification for order.placed (orderId=${orderId}, error=${result.error}, status=${result.status ?? "n/a"})`,
      );
      return;
    }

    logger.info(
      `emitted platform notification for order.placed (orderId=${orderId}, eventType=${eventType})`,
    );
  } catch (error) {
    logger.error(
      `order.placed notification handler error (orderId=${orderId}, err=${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
