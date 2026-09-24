import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withPaymentNotificationProjection } from "./payment-aware-order-management.js";

describe("payment-aware order management", () => {
  it("projects one payment event after a successful manual settlement", async () => {
    const events: unknown[] = [];
    const service = withPaymentNotificationProjection(
      {
        mutateMerchantOrder: async () => ({
          ok: true as const,
          order: {
            id: "order_1",
            customDisplayId: "ECS-1042",
            paymentStatus: "captured",
            total: 1850,
            currencyCode: "etb",
          },
        }),
      } as never,
      {
        recordNotificationEvent: async (input) => {
          events.push(input);
          return { ok: true, logCount: 0, logIds: [] };
        },
        resolveTenantIdBySalesChannelId: async () => "tenant-1",
      },
    );

    const result = await service.mutateMerchantOrder({
      action: "mark-paid",
      orderId: "order_1",
      salesChannelId: "sc_1",
      source: "telegram",
    });

    assert.equal(result.ok, true);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], {
      eventType: "payment.paid",
      payload: {
        amount: "1850",
        currencyCode: "ETB",
        orderCode: "ECS-1042",
        orderId: "order_1",
        paidAt: (events[0] as { payload: { paidAt: string } }).payload.paidAt,
        paymentStatus: "paid",
        source: "telegram",
      },
      tenantId: "tenant-1",
    });
  });

  it("does not project failed or non-payment mutations", async () => {
    const events: unknown[] = [];
    const service = withPaymentNotificationProjection(
      {
        mutateMerchantOrder: async () => ({
          ok: true as const,
          order: { id: "order_1" },
        }),
      } as never,
      {
        recordNotificationEvent: async (input) => {
          events.push(input);
          return { ok: true, logCount: 0, logIds: [] };
        },
        resolveTenantIdBySalesChannelId: async () => "tenant-1",
      },
    );

    await service.mutateMerchantOrder({
      action: "cancel",
      orderId: "order_1",
      salesChannelId: "sc_1",
    });
    assert.deepEqual(events, []);
  });
});
