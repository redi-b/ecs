import type { PlatformAppOptions } from "../app.js";
import type { MerchantOrderReturnReceiptResult } from "../types/index.js";

export async function recordReturnMovements(input: {
  actorUserId: string;
  append: NonNullable<PlatformAppOptions["appendMerchantInventoryMovement"]>;
  locationId: string;
  result: Extract<MerchantOrderReturnReceiptResult, { ok: true }>;
  tenantId: string;
}) {
  for (const movement of input.result.movements) {
    if (movement.sellableQuantity > 0) {
      await input.append({
        actorUserId: input.actorUserId,
        delta: movement.sellableQuantity,
        inventoryItemId: movement.inventoryItemId,
        locationId: input.locationId,
        note: null,
        observedAfter: null,
        observedBefore: null,
        productId: movement.productId,
        reason: "return_restock",
        sourceId: `return:${input.result.orderReturn.id}:item:${movement.lineItemId}:sellable`,
        sourceType: "platform_mutation",
        tenantId: input.tenantId,
        variantId: movement.variantId,
        ...(input.result.orderReturn.receivedAt
          ? { occurredAt: input.result.orderReturn.receivedAt }
          : {}),
      });
    }
    if (movement.damagedQuantity > 0) {
      await input.append({
        actorUserId: input.actorUserId,
        delta: 0,
        inventoryItemId: movement.inventoryItemId,
        locationId: input.locationId,
        note: null,
        observedAfter: null,
        observedBefore: null,
        productId: movement.productId,
        reason: "damaged_return",
        sourceId: `return:${input.result.orderReturn.id}:item:${movement.lineItemId}:damaged`,
        sourceType: "platform_mutation",
        tenantId: input.tenantId,
        variantId: movement.variantId,
        ...(input.result.orderReturn.receivedAt
          ? { occurredAt: input.result.orderReturn.receivedAt }
          : {}),
      });
    }
  }
}
