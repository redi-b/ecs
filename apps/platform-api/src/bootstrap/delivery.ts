import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import { createDeliverySettingsService } from "../modules/delivery/service.js";
import type { PlatformAppOptions } from "../types/platform-app.js";
import type { createTenantRuntime } from "./tenant.js";
import type { createTenantManagementRuntime } from "./tenant-management.js";

type TenantRuntime = ReturnType<typeof createTenantRuntime>;
type TenantManagementRuntime = ReturnType<typeof createTenantManagementRuntime>;

type DeliveryAppOptionKey =
  | "ensurePickupOption"
  | "getDeliverySettings"
  | "syncDeliveryShippingPrice"
  | "updateDeliverySettings";

type DeliveryRuntimeOptions = {
  db: ReturnType<typeof createPlatformDb>["db"];
  ensureTenantPickupOption: TenantRuntime["ensureTenantPickupOption"];
  getTenantCommerceContext: TenantManagementRuntime["getTenantCommerceContext"];
  logger: Pick<ReturnType<typeof createLogger>, "warn">;
  updateTenantShippingPrice: TenantRuntime["updateTenantShippingPrice"];
};

export function createDeliveryRuntime({
  db,
  ensureTenantPickupOption,
  getTenantCommerceContext,
  logger,
  updateTenantShippingPrice,
}: DeliveryRuntimeOptions): Pick<PlatformAppOptions, DeliveryAppOptionKey> {
  const deliverySettingsService = createDeliverySettingsService(db);

  return {
    ensurePickupOption: async (input) => {
      const result = await ensureTenantPickupOption(input);
      if (!result.ok) return { ok: false as const };
      return {
        ok: true as const,
        pickupOptionId: result.pickupOptionId,
        created: result.created,
      };
    },
    getDeliverySettings: deliverySettingsService.getDeliverySettings,
    syncDeliveryShippingPrice: async (input) => {
      const commerce = await getTenantCommerceContext({
        tenantId: input.tenantId,
        userId: input.userId,
      });
      if (!commerce.ok || !commerce.context.medusaShippingOptionId) {
        logger.warn(
          { tenantId: input.tenantId },
          "delivery_fee_sync_skipped_missing_shipping_option",
        );
        return {
          ok: false as const,
          error: "delivery_shipping_option_unavailable" as const,
        };
      }

      const result = await updateTenantShippingPrice({
        amount: input.amount,
        currencyCode: input.currencyCode,
        shippingOptionId: commerce.context.medusaShippingOptionId,
      });
      if (!result.ok) {
        logger.warn({ tenantId: input.tenantId, error: result.error }, "delivery_fee_sync_failed");
        return { ok: false as const, error: "commerce_backend_unavailable" as const };
      }

      // Older shops may not have the free pickup option provisioned yet.
      const pickup = await ensureTenantPickupOption({
        currencyCode: input.currencyCode,
        deliveryShippingOptionId: commerce.context.medusaShippingOptionId,
      });
      if (!pickup.ok) {
        logger.warn(
          { tenantId: input.tenantId, error: pickup.error },
          "pickup_option_ensure_failed",
        );
        return { ok: false as const, error: "pickup_option_sync_failed" as const };
      }

      return { ok: true as const };
    },
    updateDeliverySettings: deliverySettingsService.updateDeliverySettings,
  };
}
