import type { createPlatformDb } from "@ecs/db";
import { auditLogs, deliverySettings } from "@ecs/db";
import { eq } from "drizzle-orm";

import type {
  DeliverySettings,
  DeliverySettingsResult,
  DeliverySettingsUpdateResult,
} from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type DeliverySettingsRow = typeof deliverySettings.$inferSelect;

function serializeDeliverySettings(row: DeliverySettingsRow): DeliverySettings {
  return {
    tenantId: row.tenantId,
    deliveryEnabled: row.deliveryEnabled,
    pickupEnabled: row.pickupEnabled,
    phoneConfirmationRequired: row.phoneConfirmationRequired,
    notesEnabled: row.notesEnabled,
    landmarkRequired: row.landmarkRequired,
    defaultDeliveryFee: row.defaultDeliveryFee,
    currency: row.currency,
    zones: Array.isArray(row.zones) ? row.zones : [],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createDeliverySettingsService(db: PlatformDb) {
  async function getDeliverySettings(input: { tenantId: string }): Promise<DeliverySettingsResult> {
    await db
      .insert(deliverySettings)
      .values({
        tenantId: input.tenantId,
      })
      .onConflictDoNothing({
        target: deliverySettings.tenantId,
      });

    const [row] = await db
      .select()
      .from(deliverySettings)
      .where(eq(deliverySettings.tenantId, input.tenantId))
      .limit(1);

    if (!row) {
      throw new Error("Delivery settings could not be loaded.");
    }

    return {
      ok: true,
      delivery: serializeDeliverySettings(row),
    };
  }

  return {
    getDeliverySettings,
    updateDeliverySettings: async (input: {
      currency: string;
      defaultDeliveryFee: string;
      deliveryEnabled: boolean;
      landmarkRequired: boolean;
      notesEnabled: boolean;
      phoneConfirmationRequired: boolean;
      pickupEnabled: boolean;
      tenantId: string;
      userId: string;
      zones: unknown[];
    }): Promise<DeliverySettingsUpdateResult> => {
      const updated = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(deliverySettings)
          .values({
            tenantId: input.tenantId,
            deliveryEnabled: input.deliveryEnabled,
            pickupEnabled: input.pickupEnabled,
            phoneConfirmationRequired: input.phoneConfirmationRequired,
            notesEnabled: input.notesEnabled,
            landmarkRequired: input.landmarkRequired,
            defaultDeliveryFee: input.defaultDeliveryFee,
            currency: input.currency,
            zones: input.zones,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: deliverySettings.tenantId,
            set: {
              deliveryEnabled: input.deliveryEnabled,
              pickupEnabled: input.pickupEnabled,
              phoneConfirmationRequired: input.phoneConfirmationRequired,
              notesEnabled: input.notesEnabled,
              landmarkRequired: input.landmarkRequired,
              defaultDeliveryFee: input.defaultDeliveryFee,
              currency: input.currency,
              zones: input.zones,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!row) {
          throw new Error("Delivery settings upsert returned no rows.");
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "delivery.settings_updated",
          targetType: "delivery_settings",
          targetId: row.id,
          metadata: {
            deliveryEnabled: row.deliveryEnabled,
            pickupEnabled: row.pickupEnabled,
          },
        });

        return row;
      });

      return {
        ok: true,
        delivery: serializeDeliverySettings(updated),
      };
    },
  };
}
