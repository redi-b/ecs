import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantProduct } from "@ecs/contracts";

import {
  filterProductsForTable,
  getProductMediaCount,
  getProductPriceSortValue,
  getProductTableCounts,
  getProductThumbnail,
} from "./product-table-state.js";

const products: MerchantProduct[] = [
  {
    id: "prod_coffee",
    title: "Coffee beans",
    handle: "coffee-beans",
    description: null,
    status: "published",
    thumbnail: "https://cdn.example.com/coffee.jpg",
    collectionId: null,
    categoryIds: [],
    images: [{ id: "img_1", url: "https://cdn.example.com/coffee.jpg", rank: 0 }],
    variants: [
      {
        id: "var_1",
        title: "Default",
        sku: "COF-1",
        prices: [{ amount: 250, currencyCode: "etb" }],
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "prod_tea",
    title: "Black tea",
    handle: "black-tea",
    description: null,
    status: "draft",
    thumbnail: null,
    collectionId: null,
    categoryIds: [],
    images: [],
    variants: [],
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
  },
];

describe("product table state", () => {
  it("searches product title, handle, status, and id", () => {
    assert.deepEqual(
      filterProductsForTable(products, { query: "coffee", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_coffee"],
    );
    assert.deepEqual(
      filterProductsForTable(products, { query: "draft", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
    assert.deepEqual(
      filterProductsForTable(products, { query: "prod_tea", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
  });

  it("filters products by normalized status", () => {
    assert.deepEqual(
      filterProductsForTable(products, { query: "", status: "published" }).map(
        (product) => product.id,
      ),
      ["prod_coffee"],
    );
    assert.deepEqual(
      filterProductsForTable(products, { query: "", status: "draft" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
  });

  it("derives price, media, thumbnail, and filtered counts", () => {
    assert.equal(getProductPriceSortValue(products[0]), 250);
    assert.equal(getProductPriceSortValue(products[1]), null);
    assert.equal(getProductMediaCount(products[0]), 1);
    assert.equal(getProductMediaCount(products[1]), 0);
    assert.deepEqual(getProductThumbnail(products[0]), {
      kind: "image",
      url: "https://cdn.example.com/coffee.jpg",
    });
    assert.deepEqual(getProductThumbnail(products[1]), {
      initials: "BT",
      kind: "fallback",
    });
    assert.deepEqual(getProductTableCounts({ filteredCount: 1, pageCount: 2, totalCount: 9 }), {
      filteredCount: 1,
      hasActiveFilter: true,
      pageCount: 2,
      totalCount: 9,
    });
  });
});
