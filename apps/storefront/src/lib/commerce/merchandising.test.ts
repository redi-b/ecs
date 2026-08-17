import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductBadge } from "./merchandising";
import type { StoreProduct } from "./types";

const product = (overrides: Partial<StoreProduct> = {}): StoreProduct => ({
  id: "prod_1", title: "Serum", handle: "serum", description: null, thumbnail: null,
  images: [], options: [], collectionId: null, collectionTitle: null, categoryIds: [],
  priceAmount: 80, originalPriceAmount: null, discountAmount: null,
  discountPercentage: null, currencyCode: "etb", variants: [], ...overrides,
});

test("returns a truthful promotion badge only for a real reduced calculated price", () => {
  assert.deepEqual(resolveProductBadge(product({
    originalPriceAmount: 100,
    discountAmount: 20,
    discountPercentage: 20,
  })), { kind: "promotion", label: "20% off", percentage: 20 });
  assert.equal(resolveProductBadge(product({ discountPercentage: 20 })), null);
});

test("out-of-stock takes priority over promotion", () => {
  assert.deepEqual(resolveProductBadge(product({
    variants: [{
      id: "variant_1", title: null, sku: null, manageInventory: true,
      allowBackorder: false, inventoryQuantity: 0, inStock: false,
      priceAmount: 80, originalPriceAmount: 100, discountAmount: 20,
      discountPercentage: 20, currencyCode: "etb", optionValues: [],
    }],
  })), { kind: "out-of-stock", label: "Out of stock" });
});

test("does not fabricate a badge for an ordinary product", () => {
  assert.equal(resolveProductBadge(product()), null);
});
