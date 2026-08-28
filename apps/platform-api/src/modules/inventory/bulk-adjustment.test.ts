import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyBulkInventoryUpdates,
  MAX_BULK_INVENTORY_UPDATES,
  parseBulkInventoryUpdates,
} from "./bulk-adjustment.js";

describe("bulk inventory adjustment", () => {
  it("validates the complete bounded request before mutation", () => {
    assert.deepEqual(parseBulkInventoryUpdates([]), {
      ok: false,
      error: "invalid_inventory_updates",
    });
    assert.deepEqual(
      parseBulkInventoryUpdates(
        Array.from({ length: MAX_BULK_INVENTORY_UPDATES + 1 }, (_, index) => ({
          productId: `p_${index}`,
          variantId: `v_${index}`,
          stockedQuantity: index,
        })),
      ),
      { ok: false, error: "inventory_batch_too_large" },
    );
    assert.deepEqual(
      parseBulkInventoryUpdates([
        { productId: "p_1", variantId: "v_1", stockedQuantity: 2 },
        { productId: "p_1", variantId: "v_1", stockedQuantity: 3 },
      ]),
      { ok: false, error: "duplicate_inventory_update" },
    );
  });

  it("returns ordered per-row outcomes for idempotent absolute writes", async () => {
    const calls: unknown[] = [];
    const result = await applyBulkInventoryUpdates({
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      updates: [
        { productId: "p_1", variantId: "v_1", stockedQuantity: 7 },
        { productId: "p_2", variantId: "v_2", stockedQuantity: 0 },
      ],
      updateStock: async (input) => {
        calls.push(input);
        return input.productId === "p_1"
          ? {
              ok: true,
              stock: {
                productId: input.productId,
                variantId: input.variantId,
                inventoryItemId: "ii_1",
                locationId: input.stockLocationId,
                stockedQuantity: input.stockedQuantity,
                reservedQuantity: 0,
                incomingQuantity: 0,
                availableQuantity: input.stockedQuantity,
              },
            }
          : { ok: false, error: "product_not_found", status: 404 };
      },
    });

    assert.deepEqual(calls, [
      {
        productId: "p_1",
        variantId: "v_1",
        stockedQuantity: 7,
        salesChannelId: "sc_1",
        stockLocationId: "sloc_1",
      },
      {
        productId: "p_2",
        variantId: "v_2",
        stockedQuantity: 0,
        salesChannelId: "sc_1",
        stockLocationId: "sloc_1",
      },
    ]);
    assert.equal(result.succeeded, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.results[0]?.ok, true);
    assert.deepEqual(result.results[1], {
      productId: "p_2",
      variantId: "v_2",
      stockedQuantity: 0,
      ok: false,
      error: "product_not_found",
      status: 404,
    });
  });
});
