import type { MerchantInventoryMovement, MerchantInventoryMovementReason } from "@ecs/contracts";
import { type createPlatformDb, merchantInventoryMovements } from "@ecs/db";
import { and, count, desc, eq } from "drizzle-orm";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];
type MovementRow = typeof merchantInventoryMovements.$inferSelect;

function mapMovement(row: MovementRow): MerchantInventoryMovement {
  return {
    actorUserId: row.actorUserId,
    createdAt: row.occurredAt.toISOString(),
    delta: row.delta,
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    locationId: row.locationId,
    note: row.note,
    observedAfter: row.observedAfter,
    observedBefore: row.observedBefore,
    productId: row.productId,
    reason: row.reason as MerchantInventoryMovementReason,
    sourceId: row.sourceId,
    sourceType: row.sourceType as MerchantInventoryMovement["sourceType"],
    tenantId: row.tenantId,
    variantId: row.variantId,
  };
}

export type AppendMerchantInventoryMovementInput = Omit<
  MerchantInventoryMovement,
  "createdAt" | "id"
> & {
  occurredAt?: string | undefined;
};

export function createMerchantInventoryMovementStore(db: PlatformDatabase) {
  return {
    async append(input: AppendMerchantInventoryMovementInput) {
      const [inserted] = await db
        .insert(merchantInventoryMovements)
        .values({
          ...input,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) return { movement: mapMovement(inserted) };
      const [existing] = await db
        .select()
        .from(merchantInventoryMovements)
        .where(
          and(
            eq(merchantInventoryMovements.tenantId, input.tenantId),
            eq(merchantInventoryMovements.sourceType, input.sourceType),
            eq(merchantInventoryMovements.sourceId, input.sourceId),
            eq(merchantInventoryMovements.inventoryItemId, input.inventoryItemId),
            eq(merchantInventoryMovements.locationId, input.locationId),
          ),
        )
        .limit(1);
      if (!existing) throw new Error("inventory_movement_append_failed");
      return { movement: mapMovement(existing) };
    },
    async list(input: {
      inventoryItemId?: string | undefined;
      limit: number;
      locationId: string;
      offset: number;
      productId?: string | undefined;
      tenantId: string;
      variantId?: string | undefined;
    }) {
      const predicates = [
        eq(merchantInventoryMovements.tenantId, input.tenantId),
        eq(merchantInventoryMovements.locationId, input.locationId),
      ];
      if (input.inventoryItemId)
        predicates.push(eq(merchantInventoryMovements.inventoryItemId, input.inventoryItemId));
      if (input.productId)
        predicates.push(eq(merchantInventoryMovements.productId, input.productId));
      if (input.variantId)
        predicates.push(eq(merchantInventoryMovements.variantId, input.variantId));
      const where = and(...predicates);
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(merchantInventoryMovements)
          .where(where)
          .orderBy(desc(merchantInventoryMovements.occurredAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ value: count() }).from(merchantInventoryMovements).where(where),
      ]);
      return {
        count: totals[0]?.value ?? 0,
        limit: input.limit,
        movements: rows.map(mapMovement),
        offset: input.offset,
      };
    },
  };
}
