import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantProduct } from "@ecs/contracts";
import { filterProductsByInventory } from "./low-stock-products.js";

const product = (id: string, quantities: number[]): MerchantProduct => ({
  handle: id,
  id,
  status: "published",
  title: id,
  thumbnail: null,
  createdAt: null,
  updatedAt: null,
  variants: quantities.map((quantity, index) => ({
    id: `${id}_${index}`,
    title: null,
    sku: null,
    prices: [],
    stock: {
      availableQuantity: quantity,
      incomingQuantity: 0,
      locationId: "sloc_1",
      reservedQuantity: 0,
      stockedQuantity: quantity,
    },
  })),
});

describe("low-stock product filtering", () => {
  it("uses available quantity and distinguishes low from out of stock", () => {
    const products = [product("healthy", [8]), product("low", [3]), product("out", [0])];
    assert.deepEqual(
      filterProductsByInventory(products, "low_stock", 5).map((row) => row.id),
      ["low", "out"],
    );
    assert.deepEqual(
      filterProductsByInventory(products, "out_of_stock", 5).map((row) => row.id),
      ["out"],
    );
  });
});
