import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";

import { emitFulfillmentNotification } from "../lib/emit-fulfillment-notification";

export default async function shipmentCreatedNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string; no_notification?: boolean }>) {
  if (!data?.id) return;
  await emitFulfillmentNotification(container, {
    eventName: "shipment.created",
    fulfillmentId: data.id,
    noNotification: data.no_notification,
  });
}

export const config: SubscriberConfig = { event: "shipment.created" };
