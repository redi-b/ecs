import assert from "node:assert/strict";
import { test } from "node:test";
import { getProductsUrl } from "./urls";

test("image filter is forwarded on merchant and tenant product requests", () => {
  for (const tenantId of [undefined, "tenant_1"]) {
    const url = getProductsUrl({
      platformApiBaseUrl: "http://platform.local",
      tenantId,
      media: "without_media",
      status: "draft",
      categoryId: "cat_1",
      collectionId: "col_1",
      q: "coffee",
      offset: 20,
      limit: 10,
    });
    assert.equal(url.searchParams.get("media"), "without_media");
    assert.equal(url.searchParams.get("status"), "draft");
    assert.equal(url.searchParams.get("categoryId"), "cat_1");
    assert.equal(url.searchParams.get("collectionId"), "col_1");
    assert.equal(url.searchParams.get("offset"), "20");
    assert.equal(url.searchParams.get("limit"), "10");
  }
  assert.equal(
    getProductsUrl({ platformApiBaseUrl: "http://platform.local", media: "all" }).searchParams.has(
      "media",
    ),
    false,
  );
});
