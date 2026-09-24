import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { emitFulfillmentNotification } from "../lib/emit-fulfillment-notification";

export default async function orderFulfillmentCreatedNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ fulfillment_id: string; no_notification?: boolean; order_id: string }>) {
  if (!data?.fulfillment_id) return;
  await emitFulfillmentNotification(container, {
    eventName: "order.fulfillment_created",
    fulfillmentId: data.fulfillment_id,
    noNotification: data.no_notification,
    orderId: data.order_id,
  });
}

export const config: SubscriberConfig = { event: "order.fulfillment_created" };
