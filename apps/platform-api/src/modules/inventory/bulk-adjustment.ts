import type { MerchantProductStockUpdateResult } from "../../types/index.js";

export const MAX_BULK_INVENTORY_UPDATES = 50;
export const MAX_STOCKED_QUANTITY = 1_000_000_000;

export type BulkInventoryUpdate = {
  productId: string;
  variantId: string;
  stockedQuantity: number;
};

export type BulkInventoryResult = {
  failed: number;
  results: Array<
    BulkInventoryUpdate &
      (
        | { ok: true; stock: Extract<MerchantProductStockUpdateResult, { ok: true }>["stock"] }
        | { ok: false; error: string; status: number }
      )
  >;
  succeeded: number;
};

export function parseBulkInventoryUpdates(
  value: unknown,
): { ok: true; updates: BulkInventoryUpdate[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "invalid_inventory_updates" };
  }
  if (value.length > MAX_BULK_INVENTORY_UPDATES) {
    return { ok: false, error: "inventory_batch_too_large" };
  }

  const updates: BulkInventoryUpdate[] = [];
  const keys = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) {
      return { ok: false, error: "invalid_inventory_update" };
    }
    const row = candidate as Record<string, unknown>;
    const productId = typeof row.productId === "string" ? row.productId.trim() : "";
    const variantId = typeof row.variantId === "string" ? row.variantId.trim() : "";
    const stockedQuantity = row.stockedQuantity;
    if (
      !productId ||
      !variantId ||
      typeof stockedQuantity !== "number" ||
      !Number.isInteger(stockedQuantity) ||
      stockedQuantity < 0 ||
      stockedQuantity > MAX_STOCKED_QUANTITY
    ) {
      return { ok: false, error: "invalid_inventory_update" };
    }
    const key = `${productId}:${variantId}`;
    if (keys.has(key)) return { ok: false, error: "duplicate_inventory_update" };
    keys.add(key);
    updates.push({ productId, variantId, stockedQuantity });
  }
  return { ok: true, updates };
}

export async function applyBulkInventoryUpdates(input: {
  salesChannelId: string;
  stockLocationId: string;
  updates: BulkInventoryUpdate[];
  updateStock: (
    input: BulkInventoryUpdate & {
      salesChannelId: string;
      stockLocationId: string;
    },
  ) => Promise<MerchantProductStockUpdateResult>;
}): Promise<BulkInventoryResult> {
  const results: BulkInventoryResult["results"] = [];

  // Sequential writes keep load bounded and preserve input/result order. Every
  // write is an absolute quantity, so retrying failed rows is idempotent.
  for (const update of input.updates) {
    const result = await input.updateStock({
      ...update,
      salesChannelId: input.salesChannelId,
      stockLocationId: input.stockLocationId,
    });
    results.push(
      result.ok
        ? { ...update, ok: true, stock: result.stock }
        : { ...update, ok: false, error: result.error, status: result.status },
    );
  }

  const succeeded = results.filter((result) => result.ok).length;
  return { failed: results.length - succeeded, results, succeeded };
}
