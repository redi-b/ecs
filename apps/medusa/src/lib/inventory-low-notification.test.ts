import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getLowStockThreshold,
  type OrderLineForLowStock,
  selectLowStockCandidates,
  shouldNotifyLowStock,
  type VariantInventoryMeta,
} from "./inventory-low-notification";

describe("shouldNotifyLowStock", () => {
  it("uses default threshold of 5", () => {
    const prev = process.env.INVENTORY_LOW_STOCK_THRESHOLD;
    delete process.env.INVENTORY_LOW_STOCK_THRESHOLD;
    try {
      assert.equal(getLowStockThreshold(), 5);
      assert.equal(shouldNotifyLowStock(5), true);
      assert.equal(shouldNotifyLowStock(6), false);
      assert.equal(shouldNotifyLowStock(0), true);
      assert.equal(shouldNotifyLowStock(null), false);
    } finally {
      if (prev === undefined) delete process.env.INVENTORY_LOW_STOCK_THRESHOLD;
      else process.env.INVENTORY_LOW_STOCK_THRESHOLD = prev;
    }
  });

  it("respects INVENTORY_LOW_STOCK_THRESHOLD", () => {
    const prev = process.env.INVENTORY_LOW_STOCK_THRESHOLD;
    process.env.INVENTORY_LOW_STOCK_THRESHOLD = "2";
    try {
      assert.equal(getLowStockThreshold(), 2);
      assert.equal(shouldNotifyLowStock(2), true);
      assert.equal(shouldNotifyLowStock(3), false);
    } finally {
      if (prev === undefined) delete process.env.INVENTORY_LOW_STOCK_THRESHOLD;
      else process.env.INVENTORY_LOW_STOCK_THRESHOLD = prev;
    }
  });
});

describe("selectLowStockCandidates", () => {
  const lines: OrderLineForLowStock[] = [
    {
      variantId: "var_low",
      productId: "prod_1",
      productTitle: "Tee",
      variantTitle: "M",
      quantity: 1,
    },
    {
      variantId: "var_ok",
      productId: "prod_2",
      productTitle: "Hoodie",
      variantTitle: "L",
      quantity: 1,
    },
    {
      variantId: "var_unmanaged",
      productId: "prod_3",
      productTitle: "Digital",
      variantTitle: null,
      quantity: 1,
    },
    // duplicate line for same variant — should only emit once
    {
      variantId: "var_low",
      productId: "prod_1",
      productTitle: "Tee",
      variantTitle: "M",
      quantity: 1,
    },
  ];

  const meta = new Map<string, VariantInventoryMeta>([
    [
      "var_low",
      {
        variantId: "var_low",
        manageInventory: true,
        productId: "prod_1",
        productTitle: "Tee",
        variantTitle: "M",
      },
    ],
    [
      "var_ok",
      {
        variantId: "var_ok",
        manageInventory: true,
        productId: "prod_2",
        productTitle: "Hoodie",
        variantTitle: "L",
      },
    ],
    [
      "var_unmanaged",
      {
        variantId: "var_unmanaged",
        manageInventory: false,
        productId: "prod_3",
        productTitle: "Digital",
        variantTitle: null,
      },
    ],
  ]);

  it("picks managed variants at/below threshold and skips unmanaged", () => {
    const candidates = selectLowStockCandidates(
      lines,
      meta,
      {
        var_low: { availability: 5 },
        var_ok: { availability: 20 },
        // getVariantAvailability reports 0 for unmanaged — must not alert
        var_unmanaged: { availability: 0 },
      },
      5,
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.variantId, "var_low");
    assert.equal(candidates[0]?.availableQuantity, 5);
  });

  it("returns empty when all above threshold", () => {
    const candidates = selectLowStockCandidates(
      lines,
      meta,
      {
        var_low: { availability: 10 },
        var_ok: { availability: 20 },
        var_unmanaged: { availability: 0 },
      },
      5,
    );
    assert.equal(candidates.length, 0);
  });

  it("does not repeat after a variant is already below the threshold", () => {
    const candidates = selectLowStockCandidates(
      lines,
      meta,
      {
        // Two units were sold, so the inferred pre-order availability was 5.
        var_low: { availability: 3 },
        var_ok: { availability: 20 },
        var_unmanaged: { availability: 0 },
      },
      5,
    );
    assert.equal(candidates.length, 0);
  });
});
