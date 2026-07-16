import assert from "node:assert/strict";
import test from "node:test";

import { listStoreProducts } from "./platform-store.js";

test("platform-store re-export listStoreProducts still works", async () => {
  const result = await listStoreProducts({
    fetcher: async () =>
      Response.json({
        products: [{ id: "p1", title: "T", handle: "t", variants: [] }],
        count: 1,
      }),
    platformApiBaseUrl: "http://api.lvh.me",
    requestHost: "shop.lvh.me",
  });

  assert.equal("products" in result, true);
  if ("products" in result) {
    assert.equal(result.products[0]?.id, "p1");
  }
});
