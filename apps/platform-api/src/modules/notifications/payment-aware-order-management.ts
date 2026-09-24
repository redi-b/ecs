import type { createMedusaOrderService } from "../../adapters/medusa/order/index.js";
import type { NotificationEventRecordResult } from "../../types/index.js";
import { buildPaymentPaidPayload } from "./order-payload.js";

type OrderService = ReturnType<typeof createMedusaOrderService>;

export function withPaymentNotificationProjection(
  service: OrderService,
  options: {
    recordNotificationEvent: (input: {
      eventType: "payment.paid";
      payload: unknown;
      tenantId: string;
    }) => Promise<NotificationEventRecordResult>;
    resolveTenantIdBySalesChannelId: (salesChannelId: string) => Promise<string | null>;
  },
): OrderService {
  return {
    ...service,
    mutateMerchantOrder: async (input) => {
      const result = await service.mutateMerchantOrder(input);
      if (!result.ok || input.action !== "mark-paid") return result;

      try {
        const tenantId = await options.resolveTenantIdBySalesChannelId(input.salesChannelId);
        if (!tenantId) return result;
        await options.recordNotificationEvent({
          eventType: "payment.paid",
          payload: buildPaymentPaidPayload(
            result.order,
            input.source?.trim() || "merchant_manual_settlement",
          ),
          tenantId,
        });
      } catch {
        // The payment transition already committed. Delivery is best effort here and
        // duplicate-safe if another authoritative payment signal reaches the projector.
      }
      return result;
    },
  };
}
