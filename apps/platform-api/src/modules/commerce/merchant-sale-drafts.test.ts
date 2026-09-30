import assert from "node:assert/strict";
import test from "node:test";
import { createInMemoryMerchantSaleDraftStore } from "./merchant-sale-drafts.js";

test("sale-draft listing isolates quick-sale carts by channel and tenant", async () => {
  const store = createInMemoryMerchantSaleDraftStore();
  const base = {
    conflicts: [],
    ownerUserId: "user_1",
    tenantId: "tenant_1",
  };
  const content = {
    currencyCode: "etb" as const,
    currentStep: 1,
    customer: {},
    items: [{ productId: "product_1", quantity: 1, variantId: "variant_1" }],
  };
  await store.save({ ...base, content: { ...content, channel: "assisted_sale" } });
  await store.save({ ...base, content: { ...content, channel: "pos" } });
  await store.save({
    ...base,
    content: { ...content, channel: "pos" },
    tenantId: "tenant_2",
  });

  const result = await store.list({ channel: "pos", limit: 20, offset: 0, tenantId: "tenant_1" });
  assert.equal(result.count, 1);
  assert.equal(result.drafts[0]?.channel, "pos");
});
