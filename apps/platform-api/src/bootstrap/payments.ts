import type { createPlatformDb } from "@ecs/db";
import { tenants } from "@ecs/db";
import { eq } from "drizzle-orm";
import { createChapaPaymentService } from "../adapters/chapa/payment-service.js";
import type { createAnalyticsService } from "../modules/analytics/analytics-service.js";
import { isPlatformBillingTxRef } from "../modules/billing/service.js";
import type { createNotificationService } from "../modules/notifications/service.js";

type CommerceRuntime = Awaited<ReturnType<typeof import("./commerce.js").createCommerceRuntime>>;
type BillingRuntime = ReturnType<typeof import("./billing.js").createBillingRuntime>;

type PaymentRuntimeOptions = {
  billingProviderEventInbox: BillingRuntime["billingProviderEventInbox"];
  db: ReturnType<typeof createPlatformDb>["db"];
  env: NodeJS.ProcessEnv;
  orderService: CommerceRuntime["orderService"];
  recordAnalyticsEvent: ReturnType<typeof createAnalyticsService>["recordAnalyticsEvent"];
  recordNotificationEvent: ReturnType<typeof createNotificationService>["recordNotificationEvent"];
};

export function createPaymentRuntime(options: PaymentRuntimeOptions) {
  async function resolveTenantSalesChannelId(tenantId: string) {
    const [row] = await options.db
      .select({ medusaSalesChannelId: tenants.medusaSalesChannelId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return row?.medusaSalesChannelId?.trim() || null;
  }

  const chapaPaymentService = createChapaPaymentService({
    apiUrl: options.env.CHAPA_API_URL,
    onVerifiedSuccess: async ({ providerReference, tenantId, txRef }) => {
      if (isPlatformBillingTxRef(txRef)) {
        await options.billingProviderEventInbox.recordAndProcessVerifiedPayment({
          providerReference: providerReference ?? null,
          tenantId,
          txRef,
        });
        return;
      }

      const salesChannelId = await resolveTenantSalesChannelId(tenantId);
      if (!salesChannelId) return;
      await options.orderService.capturePaymentByTxRef({
        salesChannelId,
        source: "chapa_webhook",
        txRef,
      });
    },
    recordAnalyticsEvent: options.recordAnalyticsEvent,
    recordNotificationEvent: options.recordNotificationEvent,
    secretKey: options.env.CHAPA_SECRET_KEY,
  });

  async function recheckMerchantOrderPayment(input: {
    orderId: string;
    salesChannelId: string;
    tenantId: string;
  }) {
    const existing = await options.orderService.getMerchantOrder({
      orderId: input.orderId,
      salesChannelId: input.salesChannelId,
    });
    if (!existing.ok) return existing;

    const txRef = existing.order.paymentReference?.trim();
    if (!txRef) {
      return {
        ok: false as const,
        error: "order_not_fulfillable" as const,
        status: 409 as const,
      };
    }

    let verification: Awaited<ReturnType<typeof chapaPaymentService.verifyPayment>>;
    try {
      verification = await chapaPaymentService.verifyPayment(txRef);
    } catch {
      return {
        ok: false as const,
        error: "commerce_backend_unavailable" as const,
        status: 503 as const,
      };
    }

    if (!verification) {
      return {
        ok: false as const,
        error: "order_not_found" as const,
        status: 404 as const,
      };
    }

    const status = (
      typeof verification.data?.status === "string"
        ? verification.data.status
        : typeof verification.status === "string"
          ? verification.status
          : ""
    )
      .trim()
      .toLowerCase();

    if (status !== "success") {
      return {
        ok: false as const,
        error: "order_not_fulfillable" as const,
        status: 409 as const,
      };
    }

    return options.orderService.markMerchantOrderPaid({
      orderId: input.orderId,
      paymentReference: txRef,
      salesChannelId: input.salesChannelId,
      source: "chapa_recheck",
    });
  }

  return { chapaPaymentService, recheckMerchantOrderPayment };
}
