import assert from "node:assert/strict";
import test from "node:test";

import { listStoreCategories, listStoreCollections } from "./catalog.js";

const requestOptions = {
  platformApiBaseUrl: "https://platform.example.test",
  fetcher: async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/store/collections")) {
      return Response.json({
        collections: [
          {
            id: "pcol_1",
            title: "Computing",
            handle: "computing",
            metadata: { media_url: "https://cdn.example.test/computing.webp" },
          },
        ],
        count: 1,
      });
    }
    return Response.json({
      product_categories: [
        {
          id: "pcat_1",
          name: "Laptops",
          handle: "laptops",
          parent_category_id: null,
          metadata: { media_url: "https://cdn.example.test/laptops.webp" },
        },
      ],
      count: 1,
    });
  },
};

test("catalog normalization preserves taxonomy media from Medusa metadata", async () => {
  const [collections, categories] = await Promise.all([
    listStoreCollections(requestOptions),
    listStoreCategories(requestOptions),
  ]);

  assert.ok("collections" in collections);
  assert.ok("categories" in categories);
  assert.equal(collections.collections[0]?.mediaUrl, "https://cdn.example.test/computing.webp");
  assert.equal(categories.categories[0]?.mediaUrl, "https://cdn.example.test/laptops.webp");
});
