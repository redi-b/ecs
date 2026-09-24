import assert from "node:assert/strict";
import test from "node:test";
import { cartAnalyticsSubject } from "./analytics-product";

const product = { id: "prod_one", handle: "linen-shirt", variantIds: ["variant_one"] };

test("cart interest uses the canonical product ID when the variant belongs to the page", () => {
  assert.deepEqual(cartAnalyticsSubject("variant_one", product), {
    subjectType: "product",
    subjectId: "prod_one",
    properties: {
      productId: "prod_one",
      productHandle: "linen-shirt",
      variantId: "variant_one",
      identityVersion: 2,
    },
  });
});

test("related products are not attributed to the viewed product", () => {
  assert.equal(cartAnalyticsSubject("variant_other", product)?.subjectType, "variant");
  assert.equal(cartAnalyticsSubject("variant_other", product)?.subjectId, "variant_other");
});

test("listing cards retain variant identity and empty selections are ignored", () => {
  assert.equal(cartAnalyticsSubject("variant_one")?.subjectId, "variant_one");
  assert.equal(cartAnalyticsSubject("", product), null);
});
