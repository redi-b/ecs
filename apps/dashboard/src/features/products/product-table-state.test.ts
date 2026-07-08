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
  parseProductMediaFilter,
  parseProductStatusFilter,
  parseProductStockFilter,
  parseProductVariantCountFilter,
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
    categoryIds: ["pcat_beans"],
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
        stock: {
          locationId: "sloc_1",
          stockedQuantity: 5,
          reservedQuantity: 1,
          incomingQuantity: 0,
          availableQuantity: 4,
        },
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

const multiVariantProduct: MerchantProduct = {
  ...coffeeProduct,
  id: "prod_roast",
  title: "Roast sampler",
  handle: "roast-sampler",
  collectionId: "pcol_featured",
  categoryIds: ["pcat_beans", "pcat_gifts"],
  variants: [
    {
      id: "var_dark",
      title: "Dark",
      sku: "ROAST-DARK",
      prices: [{ amount: 300, currencyCode: "etb" }],
      stock: {
        locationId: "sloc_1",
        stockedQuantity: 0,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 0,
      },
    },
    {
      id: "var_light",
      title: "Light",
      sku: "ROAST-LIGHT",
      prices: [{ amount: 300, currencyCode: "etb" }],
      stock: {
        locationId: "sloc_1",
        stockedQuantity: 0,
        reservedQuantity: 0,
        incomingQuantity: 0,
        availableQuantity: 0,
      },
    },
  ],
};

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

  it("filters products by stock, media, variant count, collection, and category", () => {
    const catalog = [...products, multiVariantProduct];

    assert.deepEqual(
      filterProductsForTable(catalog, { query: "", status: "all", stock: "in_stock" }).map(
        (product) => product.id,
      ),
      ["prod_coffee"],
    );
    assert.deepEqual(
      filterProductsForTable(catalog, { query: "", status: "all", stock: "out_of_stock" }).map(
        (product) => product.id,
      ),
      ["prod_roast"],
    );
    assert.deepEqual(
      filterProductsForTable(catalog, { query: "", status: "all", stock: "not_tracked" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
    assert.deepEqual(
      filterProductsForTable(catalog, { media: "without_media", query: "", status: "all" }).map(
        (product) => product.id,
      ),
      ["prod_tea"],
    );
    assert.deepEqual(
      filterProductsForTable(catalog, {
        query: "",
        status: "all",
        variantCount: "multi_variant",
      }).map((product) => product.id),
      ["prod_roast"],
    );
    assert.deepEqual(
      filterProductsForTable(catalog, {
        collectionId: "pcol_featured",
        query: "",
        status: "all",
      }).map((product) => product.id),
      ["prod_roast"],
    );
    assert.deepEqual(
      filterProductsForTable(catalog, {
        categoryId: "pcat_gifts",
        query: "",
        status: "all",
      }).map((product) => product.id),
      ["prod_roast"],
    );
  });

  it("normalizes statuses case-insensitively and maps unexpected statuses to unknown", () => {
    assert.equal(normalizeProductStatus("PUBLISHED"), "published");
    assert.equal(normalizeProductStatus("Draft"), "draft");
    assert.equal(normalizeProductStatus(" published "), "published");
    assert.equal(normalizeProductStatus("archived"), "unknown");
    assert.equal(normalizeProductStatus(null), "unknown");
  });

  it("parses URL-backed product status filters safely", () => {
    assert.equal(parseProductStatusFilter("published"), "published");
    assert.equal(parseProductStatusFilter(" Draft "), "draft");
    assert.equal(parseProductStatusFilter("unknown"), "unknown");
    assert.equal(parseProductStatusFilter("all"), "all");
    assert.equal(parseProductStatusFilter("archived"), "all");
    assert.equal(parseProductStatusFilter(undefined), "all");
    assert.equal(parseProductStatusFilter(["published", "draft"]), "published");
    assert.equal(parseProductStockFilter("in_stock"), "in_stock");
    assert.equal(parseProductStockFilter("out_of_stock"), "out_of_stock");
    assert.equal(parseProductStockFilter("not_tracked"), "not_tracked");
    assert.equal(parseProductStockFilter("missing"), "all");
    assert.equal(parseProductMediaFilter("with_media"), "with_media");
    assert.equal(parseProductMediaFilter("without_media"), "without_media");
    assert.equal(parseProductMediaFilter("missing"), "all");
    assert.equal(parseProductVariantCountFilter("no_variants"), "no_variants");
    assert.equal(parseProductVariantCountFilter("single_variant"), "single_variant");
    assert.equal(parseProductVariantCountFilter("multi_variant"), "multi_variant");
    assert.equal(parseProductVariantCountFilter("missing"), "all");
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
      getProductThumbnail({
        ...teaProduct,
        thumbnail: "   ",
      }),
      {
        initials: "BT",
        kind: "fallback",
      },
    );
    assert.deepEqual(
      getProductThumbnail({
        ...coffeeProduct,
        thumbnail: " https://cdn.example.com/coffee.jpg ",
      }),
      {
        kind: "image",
        url: "https://cdn.example.com/coffee.jpg",
      },
    );
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
    assert.deepEqual(
      getProductTableCounts({
        filteredCount: 2,
        filters: { media: "with_media", query: "", status: "all" },
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
