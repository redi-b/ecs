import { z } from "zod";

export const merchantInventoryMovementReasonSchema = z.enum([
  "opening_balance",
  "manual_count",
  "stock_received",
  "correction_add",
  "correction_remove",
  "sale_commit",
  "reservation",
  "reservation_release",
  "cancellation",
  "return_restock",
  "damaged_return",
  "import",
  "system_repair",
]);
export type MerchantInventoryMovementReason = z.infer<typeof merchantInventoryMovementReasonSchema>;

export const merchantInventoryMovementSchema = z.object({
  actorUserId: z.string().nullable(),
  createdAt: z.string().datetime(),
  delta: z.number().int(),
  id: z.string().min(1),
  inventoryItemId: z.string().min(1),
  locationId: z.string().min(1),
  note: z.string().nullable(),
  observedAfter: z.number().int().nullable(),
  observedBefore: z.number().int().nullable(),
  productId: z.string().nullable(),
  reason: merchantInventoryMovementReasonSchema,
  sourceId: z.string().min(1),
  sourceType: z.enum(["manual_adjustment", "medusa_event", "import", "repair"]),
  tenantId: z.string().min(1),
  variantId: z.string().nullable(),
});
export type MerchantInventoryMovement = z.infer<typeof merchantInventoryMovementSchema>;

export const merchantInventoryMovementsResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  movements: z.array(merchantInventoryMovementSchema),
  offset: z.number().int().nonnegative(),
});
