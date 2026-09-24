import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emitFulfillmentNotification,
  type FulfillmentNotificationContainer,
} from "./emit-fulfillment-notification";

function fixture() {
  const logs: string[] = [];
  const container = {
    resolve(name: string) {
      if (name === "logger") {
        return {
          error: (value: string) => logs.push(value),
          info: (value: string) => logs.push(value),
          warn: (value: string) => logs.push(value),
        };
      }
      return {
        graph: async () => ({
          data: [{ order: { id: "order_1", sales_channel_id: "sc_1", items: [] } }],
        }),
      };
    },
  };
  return { container: container as FulfillmentNotificationContainer, logs };
}

describe("emitFulfillmentNotification", () => {
  it("maps shipment completion to one out-for-delivery event", async () => {
    const { container } = fixture();
    const emitted: unknown[] = [];
    const result = await emitFulfillmentNotification(
      container,
      { eventName: "shipment.created", fulfillmentId: "ful_1" },
      async (input) => {
        emitted.push(input);
        return { ok: true, status: 200, body: {} };
      },
    );
    assert.equal(result.emitted, true);
    assert.deepEqual(emitted, [
      {
        eventType: "order.out_for_delivery",
        medusaSalesChannelId: "sc_1",
        sourceEventId: "shipment.created:ful_1",
        payload: {
          fulfillmentId: "ful_1",
          medusaSalesChannelId: "sc_1",
          orderId: "order_1",
          publicOrderReference: "ORD-1",
          source: "medusa",
        },
      },
    ]);
  });

  it("does not emit when the workflow suppresses notifications", async () => {
    const { container } = fixture();
    let emitted = false;
    const result = await emitFulfillmentNotification(
      container,
      { eventName: "delivery.created", fulfillmentId: "ful_1", noNotification: true },
      async () => {
        emitted = true;
        return { ok: true, status: 200, body: {} };
      },
    );
    assert.equal(result.emitted, false);
    assert.equal(emitted, false);
  });
});
