import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantProduct } from "@ecs/contracts";

import {
  filterProductsForTable,
  getProductMediaCount,
  getProductPriceSortValue,
  getProductTableCounts,
  getProductThumbnail,
  normalizeProductStatus,
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
    images: [
      {
        id: "img_1",
        url: "https://cdn.example.com/coffee.jpg",
        rank: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
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

const coffeeProduct = products[0];
const teaProduct = products[1];

assert.ok(coffeeProduct);
assert.ok(teaProduct);

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

  it("keeps all products for whitespace-only queries", () => {
    assert.deepEqual(
      filterProductsForTable(products, { query: "   ", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_coffee", "prod_tea"],
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

  it("normalizes statuses case-insensitively and maps unexpected statuses to unknown", () => {
    assert.equal(normalizeProductStatus("PUBLISHED"), "published");
    assert.equal(normalizeProductStatus("Draft"), "draft");
    assert.equal(normalizeProductStatus("archived"), "unknown");
    assert.equal(normalizeProductStatus(null), "unknown");
  });

  it("derives price, media, thumbnail, and filtered counts", () => {
    assert.equal(getProductPriceSortValue(coffeeProduct), 250);
    assert.equal(getProductPriceSortValue(teaProduct), null);
    assert.equal(getProductMediaCount(coffeeProduct), 1);
    assert.equal(getProductMediaCount(teaProduct), 0);
    assert.deepEqual(getProductThumbnail(coffeeProduct), {
      kind: "image",
      url: "https://cdn.example.com/coffee.jpg",
    });
    assert.deepEqual(getProductThumbnail(teaProduct), {
      initials: "BT",
      kind: "fallback",
    });
    assert.deepEqual(
      getProductTableCounts({
        filteredCount: 1,
        filters: { query: "coffee", status: "all" },
        pageCount: 2,
        totalCount: 9,
      }),
      {
        filteredCount: 1,
        hasActiveFilter: true,
        pageCount: 2,
        totalCount: 9,
      },
    );
  });

  it("counts distinct thumbnail and image URLs as product media", () => {
    assert.equal(
      getProductMediaCount({
        ...coffeeProduct,
        images: [
          {
            id: "img_1",
            rank: 0,
            url: "https://cdn.example.com/coffee.jpg",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
        thumbnail: "https://cdn.example.com/coffee.jpg",
      }),
      1,
    );
    assert.equal(
      getProductMediaCount({
        ...coffeeProduct,
        images: [
          {
            id: "img_2",
            rank: 0,
            url: "https://cdn.example.com/coffee-side.jpg",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
        thumbnail: "https://cdn.example.com/coffee.jpg",
      }),
      2,
    );
    assert.equal(
      getProductMediaCount({
        ...teaProduct,
        images: [
          {
            id: "img_3",
            rank: 0,
            url: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "img_4",
            rank: 1,
            url: "",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      }),
      0,
    );
    assert.equal(
      getProductMediaCount({
        ...teaProduct,
        thumbnail: "   ",
      }),
      0,
    );
    assert.equal(
      getProductMediaCount({
        ...coffeeProduct,
        images: [
          {
            id: "img_5",
            rank: 0,
            url: "https://cdn.example.com/coffee.jpg",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
        thumbnail: " https://cdn.example.com/coffee.jpg ",
      }),
      1,
    );
  });

  it("derives active filter state from filter input", () => {
    assert.deepEqual(
      getProductTableCounts({
        filteredCount: 2,
        filters: { query: "   ", status: "all" },
        pageCount: 2,
        totalCount: 2,
      }),
      {
        filteredCount: 2,
        hasActiveFilter: false,
        pageCount: 2,
        totalCount: 2,
      },
    );
    assert.deepEqual(
      getProductTableCounts({
        filteredCount: 2,
        filters: { query: "tea", status: "all" },
        pageCount: 2,
        totalCount: 2,
      }),
      {
        filteredCount: 2,
        hasActiveFilter: true,
        pageCount: 2,
        totalCount: 2,
      },
    );
    assert.deepEqual(
      getProductTableCounts({
        filteredCount: 2,
        filters: { query: "", status: "draft" },
        pageCount: 2,
        totalCount: 2,
      }),
      {
        filteredCount: 2,
        hasActiveFilter: true,
        pageCount: 2,
        totalCount: 2,
      },
    );
  });

  it("derives fallback thumbnail initials from handle or id when title is missing", () => {
    assert.deepEqual(
      getProductThumbnail({
        ...teaProduct,
        handle: "green-tea",
        id: "prod_green_tea",
        title: null,
      }),
      {
        initials: "GT",
        kind: "fallback",
      },
    );
    assert.deepEqual(
      getProductThumbnail({
        ...teaProduct,
        handle: null,
        id: "prod_mint_tea",
        title: null,
      }),
      {
        initials: "PM",
        kind: "fallback",
      },
    );
  });
});
