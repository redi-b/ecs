import assert from "node:assert/strict";
import test from "node:test";

import { toProductSearchDocument } from "./product-search-document";

test("normalizes a tenant-filterable product search document", () => {
  const document = toProductSearchDocument({
    id: "prod_1",
    title: "  Cotton Wrap  ",
    handle: "cotton-wrap",
    status: "published",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    sales_channels: [{ id: "sc_1" }, { id: "sc_1" }],
    categories: [{ id: "cat_1", name: "Fashion" }],
    collection: { id: "col_1", title: "New arrivals" },
    tags: [{ value: "linen" }],
    options: [{ values: [{ value: "Small" }, { value: "Small" }, { value: "Large" }] }],
    variants: [
      { title: "Small", sku: "WRAP-S", barcode: "10001" },
      { title: "Large", sku: "WRAP-L", barcode: "10002" },
    ],
  });

  assert.equal(document.title, "Cotton Wrap");
  assert.deepEqual(document.sales_channel_ids, ["sc_1"]);
  assert.deepEqual(document.option_values, ["Small", "Large"]);
  assert.deepEqual(document.skus, ["WRAP-S", "WRAP-L"]);
  assert.equal(document.created_at, Date.parse("2026-01-01T00:00:00.000Z"));
});
