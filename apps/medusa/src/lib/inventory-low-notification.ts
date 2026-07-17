import type { MedusaContainer } from "@medusajs/framework/types";
import { getVariantAvailability } from "@medusajs/framework/utils";

import { emitPlatformNotificationEvent } from "./platform-notifications";

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
  }) => Promise<{ data: unknown[] }>;
};

/** Default: notify when available quantity is at or below this. */
export function getLowStockThreshold(): number {
  const raw = process.env.INVENTORY_LOW_STOCK_THRESHOLD?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 5;
}

export function shouldNotifyLowStock(quantity: number | null | undefined): boolean {
  if (quantity == null || !Number.isFinite(quantity)) {
    return false;
  }
  return quantity <= getLowStockThreshold();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type OrderLineForLowStock = {
  productId: string | null;
  variantId: string;
  productTitle: string | null;
  variantTitle: string | null;
};

export type VariantInventoryMeta = {
  variantId: string;
  manageInventory: boolean;
  productId: string | null;
  productTitle: string | null;
  variantTitle: string | null;
};

export type LowStockCandidate = {
  productId: string | null;
  variantId: string;
  productTitle: string | null;
  variantTitle: string | null;
  availableQuantity: number;
};

/**
 * Pure selection: inventory-managed variants at/below threshold.
 * Non-managed variants are skipped (getVariantAvailability returns 0 for those).
 */
export function selectLowStockCandidates(
  lines: OrderLineForLowStock[],
  metaByVariant: Map<string, VariantInventoryMeta>,
  availabilityByVariant: Record<string, { availability?: number | null } | undefined>,
  threshold: number,
): LowStockCandidate[] {
  const seen = new Set<string>();
  const out: LowStockCandidate[] = [];

  for (const line of lines) {
    if (seen.has(line.variantId)) continue;
    seen.add(line.variantId);

    const meta = metaByVariant.get(line.variantId);
    // Only inventory-managed variants. Unmanaged report availability 0 from
    // getVariantAvailability and must not trigger false low-stock alerts.
    if (!meta?.manageInventory) {
      continue;
    }

    const availability = getNumber(availabilityByVariant[line.variantId]?.availability);
    if (availability == null || availability > threshold) {
      continue;
    }

    out.push({
      productId: line.productId ?? meta?.productId ?? null,
      variantId: line.variantId,
      productTitle: line.productTitle ?? meta?.productTitle ?? null,
      variantTitle: line.variantTitle ?? meta?.variantTitle ?? null,
      availableQuantity: availability,
    });
  }

  return out;
}

/**
 * After a sale, check remaining inventory for ordered variants and emit
 * inventory.low to platform when stock is at/below threshold.
 * Merchant stock edits intentionally do not fire this — only sales-driven drops.
 */
export async function emitLowStockNotificationsForOrder(
  container: MedusaContainer,
  input: {
    orderId: string;
    medusaSalesChannelId: string;
  },
): Promise<{ checked: number; emitted: number }> {
  const logger = container.resolve("logger") as {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
  const query = container.resolve("query") as QueryGraph;

  const lines = await loadOrderLinesForLowStock(query, input.orderId);
  if (!lines.length) {
    return { checked: 0, emitted: 0 };
  }

  const variantIds = [...new Set(lines.map((line) => line.variantId))];
  const metaByVariant = await loadVariantInventoryMeta(query, variantIds);

  let availabilityByVariant: Record<string, { availability?: number | null }> = {};
  try {
    // Query from container is a full Remote Query client; local type is the graph subset we use.
    availabilityByVariant = (await getVariantAvailability(query as never, {
      variant_ids: variantIds,
      sales_channel_id: input.medusaSalesChannelId,
    })) as Record<string, { availability?: number | null }>;
  } catch (error) {
    logger.warn(
      `low-stock check: getVariantAvailability failed (orderId=${input.orderId}, err=${error instanceof Error ? error.message : String(error)})`,
    );
    return { checked: 0, emitted: 0 };
  }

  const threshold = getLowStockThreshold();
  const candidates = selectLowStockCandidates(
    lines,
    metaByVariant,
    availabilityByVariant,
    threshold,
  );

  let emitted = 0;
  for (const candidate of candidates) {
    const payload: Record<string, unknown> = {
      orderId: input.orderId,
      variantId: candidate.variantId,
      threshold,
      availableQuantity: candidate.availableQuantity,
      stockedQuantity: candidate.availableQuantity,
      source: "medusa",
      trigger: "order.placed",
    };
    if (candidate.productId) payload.productId = candidate.productId;
    if (candidate.productTitle) payload.productTitle = candidate.productTitle;
    if (candidate.variantTitle) payload.variantTitle = candidate.variantTitle;

    const result = await emitPlatformNotificationEvent({
      eventType: "inventory.low",
      medusaSalesChannelId: input.medusaSalesChannelId,
      sourceEventId: `inventory.low:${candidate.variantId}:${input.orderId}`,
      payload,
    });

    if (!result.ok) {
      logger.error(
        `failed to emit inventory.low (orderId=${input.orderId}, variantId=${candidate.variantId}, error=${result.error})`,
      );
      continue;
    }

    emitted += 1;
    logger.info(
      `emitted inventory.low (orderId=${input.orderId}, variantId=${candidate.variantId}, available=${candidate.availableQuantity})`,
    );
  }

  return { checked: variantIds.length, emitted };
}

async function loadOrderLinesForLowStock(
  query: QueryGraph,
  orderId: string,
): Promise<OrderLineForLowStock[]> {
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "items.variant_id",
      "items.product_id",
      "items.title",
      "items.variant_title",
      "items.product_title",
    ],
    filters: { id: orderId },
  });

  const [row] = data;
  const raw = asRecord(row);
  if (!raw || !Array.isArray(raw.items)) {
    return [];
  }

  const lines: OrderLineForLowStock[] = [];
  for (const entry of raw.items) {
    const item = asRecord(entry);
    if (!item) continue;
    const variantId = getString(item.variant_id);
    if (!variantId) continue;
    lines.push({
      variantId,
      productId: getString(item.product_id),
      productTitle: getString(item.product_title) ?? getString(item.title),
      variantTitle: getString(item.variant_title),
    });
  }
  return lines;
}

async function loadVariantInventoryMeta(
  query: QueryGraph,
  variantIds: string[],
): Promise<Map<string, VariantInventoryMeta>> {
  const map = new Map<string, VariantInventoryMeta>();
  if (!variantIds.length) return map;

  // entity "variant" is the Query alias used by Medusa for product variants
  const { data } = await query.graph({
    entity: "variant",
    fields: ["id", "title", "manage_inventory", "product_id", "product.title"],
    filters: { id: variantIds },
  });

  for (const entry of data ?? []) {
    const variant = asRecord(entry);
    if (!variant) continue;
    const variantId = getString(variant.id);
    if (!variantId) continue;
    const product = asRecord(variant.product);
    map.set(variantId, {
      variantId,
      manageInventory: variant.manage_inventory === true || variant.manage_inventory === "true",
      productId: getString(variant.product_id) ?? getString(product?.id),
      productTitle: getString(product?.title),
      variantTitle: getString(variant.title),
    });
  }
  return map;
}
