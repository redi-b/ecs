import {
  buildCommerceEventIdentity,
  getMedusaEventOccurrenceId,
  merchantInventoryMovementReasonSchema,
  pinnedMedusaCommerceEvents,
} from "@ecs/contracts";
import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

type Dependencies = Pick<
  PlatformAppOptions,
  "appendMerchantInventoryMovement" | "internalApiToken" | "resolveTenantIdByMedusaSalesChannelId"
>;

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export function registerPlatformInternalInventoryEventRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
  app.post("/platform/internal/inventory/events", async (context) => {
    const expected = options.internalApiToken?.trim();
    if (!expected || context.req.header("x-platform-internal-token") !== expected) {
      return context.json({ error: "internal_auth_required" }, 401);
    }
    if (!options.appendMerchantInventoryMovement) {
      return context.json({ error: "inventory_movement_ledger_unavailable" }, 503);
    }
    const body = (await context.req.json().catch(() => undefined)) as
      | Record<string, unknown>
      | undefined;
    if (!body) return context.json({ error: "invalid_inventory_event" }, 400);
    const eventName = stringValue(body, "eventName");
    const cardinality =
      pinnedMedusaCommerceEvents[eventName as keyof typeof pinnedMedusaCommerceEvents];
    const subjectId = stringValue(body, "subjectId");
    const subjectType = stringValue(body, "subjectType");
    const salesChannelId = stringValue(body, "medusaSalesChannelId");
    const inventoryItemId = stringValue(body, "inventoryItemId");
    const locationId = stringValue(body, "locationId");
    const reason = merchantInventoryMovementReasonSchema.safeParse(body.reason);
    if (
      !cardinality ||
      !subjectId ||
      !subjectType ||
      !salesChannelId ||
      !inventoryItemId ||
      !locationId ||
      !reason.success
    ) {
      return context.json({ error: "invalid_inventory_event" }, 400);
    }
    if (
      typeof body.delta !== "number" ||
      !Number.isInteger(body.delta) ||
      typeof body.observedBefore !== "number" ||
      !Number.isInteger(body.observedBefore) ||
      typeof body.observedAfter !== "number" ||
      !Number.isInteger(body.observedAfter) ||
      body.observedAfter - body.observedBefore !== body.delta
    ) {
      return context.json({ error: "inventory_event_delta_unproven" }, 422);
    }
    const metadata =
      typeof body.metadata === "object" && body.metadata !== null
        ? (body.metadata as { created_at?: unknown; eventGroupId?: unknown })
        : null;
    const occurrenceId = getMedusaEventOccurrenceId({ cardinality, metadata, subjectId });
    if (!occurrenceId) {
      return context.json({ error: "inventory_event_occurrence_unproven" }, 422);
    }
    if (!options.resolveTenantIdByMedusaSalesChannelId) {
      return context.json({ error: "tenant_resolution_unavailable" }, 503);
    }
    const tenantId = await options.resolveTenantIdByMedusaSalesChannelId(salesChannelId);
    if (!tenantId) return context.json({ error: "tenant_not_found_for_sales_channel" }, 404);
    const sourceId = buildCommerceEventIdentity({
      eventName,
      occurrenceId,
      origin: "medusa",
      subjectId,
      subjectType,
    });
    const result = await options.appendMerchantInventoryMovement({
      actorUserId: null,
      delta: body.delta,
      inventoryItemId,
      locationId,
      note: null,
      observedAfter: body.observedAfter,
      observedBefore: body.observedBefore,
      productId: stringValue(body, "productId") || null,
      reason: reason.data,
      sourceId,
      sourceType: "medusa_event",
      tenantId,
      variantId: stringValue(body, "variantId") || null,
      ...(typeof body.occurredAt === "string" ? { occurredAt: body.occurredAt } : {}),
    });
    return context.json({ movement: result.movement }, 201);
  });
}
