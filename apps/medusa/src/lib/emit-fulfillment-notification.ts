import {
  loadOrderForFulfillmentNotification,
  loadOrderForNotification,
  type QueryGraph,
} from "./load-order-for-notification";
import {
  buildOrderNotificationPayload,
  emitPlatformNotificationEvent,
  medusaToPlatformNotificationEvent,
  type PlatformNotificationEmitInput,
} from "./platform-notifications";

type Logger = {
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
};
export type FulfillmentNotificationContainer = {
  resolve(name: "logger"): Logger;
  resolve(name: "query"): QueryGraph;
};

export async function emitFulfillmentNotification(
  container: FulfillmentNotificationContainer,
  input: {
    eventName: "delivery.created" | "order.fulfillment_created" | "shipment.created";
    fulfillmentId: string;
    noNotification?: boolean | undefined;
    orderId?: string | undefined;
  },
  emit: (
    input: PlatformNotificationEmitInput,
  ) => ReturnType<typeof emitPlatformNotificationEvent> = emitPlatformNotificationEvent,
) {
  const logger = container.resolve("logger");
  if (input.noNotification) {
    logger.info(`${input.eventName} notification skipped by workflow`);
    return { emitted: false as const, reason: "suppressed" as const };
  }

  const query = container.resolve("query");
  const order = input.orderId
    ? await loadOrderForNotification(query, input.orderId)
    : await loadOrderForFulfillmentNotification(query, input.fulfillmentId);
  if (!order?.sales_channel_id) {
    logger.warn(
      `${input.eventName} notification skipped: order or sales_channel_id missing (fulfillmentId=${input.fulfillmentId})`,
    );
    return { emitted: false as const, reason: "order_not_found" as const };
  }

  const eventType = medusaToPlatformNotificationEvent[input.eventName];
  if (!eventType) {
    logger.error(`${input.eventName} notification skipped: platform event mapping missing`);
    return { emitted: false as const, reason: "mapping_missing" as const };
  }

  const result = await emit({
    eventType,
    medusaSalesChannelId: order.sales_channel_id,
    sourceEventId: `${input.eventName}:${input.fulfillmentId}`,
    payload: {
      ...buildOrderNotificationPayload(order),
      fulfillmentId: input.fulfillmentId,
    },
  });
  if (!result.ok) {
    logger.error(
      `failed to emit platform notification for ${input.eventName} (fulfillmentId=${input.fulfillmentId}, error=${result.error}, status=${result.status ?? "n/a"})`,
    );
    return { emitted: false as const, reason: "delivery_failed" as const };
  }
  logger.info(
    `emitted platform notification for ${input.eventName} (orderId=${order.id}, eventType=${eventType})`,
  );
  return { emitted: true as const, eventType };
}
