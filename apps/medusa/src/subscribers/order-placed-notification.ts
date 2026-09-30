import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { emitLowStockNotificationsForOrder } from "../lib/inventory-low-notification";
import { loadOrderForNotification } from "../lib/load-order-for-notification";
import {
  buildOrderNotificationPayload,
  emitPlatformNotificationEvent,
  emitPlatformOrderCostSnapshot,
  medusaToPlatformNotificationEvent,
} from "../lib/platform-notifications";

export class OrderCostSnapshotRetryError extends Error {
  readonly name = "OrderCostSnapshotRetryError";
}

export function requireOrderCostSnapshot(
  result: Awaited<ReturnType<typeof emitPlatformOrderCostSnapshot>>,
  orderId: string,
) {
  if (!result.ok) {
    throw new OrderCostSnapshotRetryError(
      `failed to capture order costs (orderId=${orderId}, error=${result.error}, status=${result.status ?? "n/a"})`,
    );
  }
}

/**
 * order.placed → platform order.created + sales-driven inventory.low when stock is low.
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
    const costSnapshot = await emitPlatformOrderCostSnapshot({
      medusaSalesChannelId: order.sales_channel_id,
      orderId: order.id,
      orderPlacedAt: order.created_at ?? new Date().toISOString(),
      items: (order.items ?? []).flatMap((item) =>
        item.id && item.quantity && item.quantity > 0
          ? [
              {
                lineItemId: item.id,
                quantity: item.quantity,
                unitCostAmount: item.unit_cost_amount ?? null,
                variantId: item.variant_id ?? null,
              },
            ]
          : [],
      ),
    });
    requireOrderCostSnapshot(costSnapshot, orderId);
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
    } else {
      logger.info(
        `emitted platform notification for order.placed (orderId=${orderId}, eventType=${eventType})`,
      );
    }

    // Sales-driven only: after inventory is reserved/decreased by the order.
    try {
      const lowStock = await emitLowStockNotificationsForOrder(container, {
        orderId: order.id,
        medusaSalesChannelId: order.sales_channel_id,
      });
      if (lowStock.emitted > 0) {
        logger.info(
          `low-stock alerts after order.placed (orderId=${orderId}, checked=${lowStock.checked}, emitted=${lowStock.emitted})`,
        );
      }
    } catch (lowStockError) {
      logger.error(
        `low-stock check failed after order.placed (orderId=${orderId}, err=${lowStockError instanceof Error ? lowStockError.message : String(lowStockError)})`,
      );
    }
  } catch (error) {
    logger.error(
      `order.placed notification handler error (orderId=${orderId}, err=${error instanceof Error ? error.message : String(error)})`,
    );
    // The snapshot endpoint is idempotent. Propagating this one failure lets the
    // event delivery retry without risking a duplicate cost row or order.
    if (error instanceof OrderCostSnapshotRetryError) throw error;
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
