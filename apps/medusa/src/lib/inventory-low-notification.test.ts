import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getLowStockThreshold,
  selectLowStockCandidates,
  shouldNotifyLowStock,
  type OrderLineForLowStock,
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
    },
    {
      variantId: "var_ok",
      productId: "prod_2",
      productTitle: "Hoodie",
      variantTitle: "L",
    },
    {
      variantId: "var_unmanaged",
      productId: "prod_3",
      productTitle: "Digital",
      variantTitle: null,
    },
    // duplicate line for same variant — should only emit once
    {
      variantId: "var_low",
      productId: "prod_1",
      productTitle: "Tee",
      variantTitle: "M",
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
        var_low: { availability: 3 },
        var_ok: { availability: 20 },
        // getVariantAvailability reports 0 for unmanaged — must not alert
        var_unmanaged: { availability: 0 },
      },
      5,
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.variantId, "var_low");
    assert.equal(candidates[0]?.availableQuantity, 3);
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
});
