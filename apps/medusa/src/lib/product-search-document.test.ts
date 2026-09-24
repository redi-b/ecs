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
    options: [{ title: "Size", values: [{ value: "Small" }, { value: "Small" }, { value: "Large" }] }],
    variants: [
      { title: "Small", sku: "WRAP-S", barcode: "10001", calculated_price: { calculated_amount: 850, currency_code: "etb" } },
      { title: "Large", sku: "WRAP-L", barcode: "10002", calculated_price: { calculated_amount: 950, currency_code: "ETB" } },
    ],
  });

  assert.equal(document.title, "Cotton Wrap");
  assert.equal(document.id, "en-ET:prod_1");
  assert.equal(document.product_id, "prod_1");
  assert.equal(document.locale, "en-ET");
  assert.deepEqual(document.sales_channel_ids, ["sc_1"]);
  assert.deepEqual(document.option_values, ["Small", "Large"]);
  assert.deepEqual(document.option_pairs, ['["Size","Small"]', '["Size","Large"]']);
  assert.equal(document.price_min_etb, 850);
  assert.equal(document.price_max_etb, 950);
  assert.deepEqual(document.skus, ["WRAP-S", "WRAP-L"]);
  assert.equal(document.created_at, Date.parse("2026-01-01T00:00:00.000Z"));
});

test("uses ETB variant prices when contextual calculated prices are unavailable", () => {
  const document = toProductSearchDocument({
    id: "prod_demo",
    variants: [
      { title: "Default", calculated_price: null, prices: [{ amount: 1850, currency_code: "etb" }] },
      { title: "Large", prices: [{ amount: 2100, currency_code: "ETB" }, { amount: 20, currency_code: "usd" }] },
    ],
  });

  assert.equal(document.price_min_etb, 1850);
  assert.equal(document.price_max_etb, 2100);
});
