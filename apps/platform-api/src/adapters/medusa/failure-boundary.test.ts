import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMedusaCustomerService } from "./customer-service.js";
import { createMedusaOrderService } from "./order/service.js";
import { productExistsInSalesChannel } from "./product/ownership.js";

const upstreamFailure = async () =>
  Response.json({ message: "internal Medusa error" }, { status: 500 });

describe("Medusa adapter failure boundary", () => {
  it("does not report order backend exceptions as service unavailability", async () => {
    const service = createMedusaOrderService({
      adminApiToken: "secret",
      fetcher: upstreamFailure as typeof fetch,
      medusaInternalUrl: "http://medusa.test",
    });

    const result = await service.getMerchantOrder({
      orderId: "order_1",
      salesChannelId: "sc_1",
    });

    assert.deepEqual(result, {
      error: "commerce_backend_error",
      ok: false,
      status: 502,
    });
  });

  it("preserves backend failures from nested customer-group lookups", async () => {
    const service = createMedusaCustomerService({
      adminApiToken: "secret",
      fetcher: upstreamFailure as typeof fetch,
      medusaInternalUrl: "http://medusa.test",
    });

    const result = await service.listGroups({ tenantId: "tenant_1" });

    assert.deepEqual(result, {
      error: "commerce_backend_error",
      ok: false,
      status: 502,
    });
  });

  it("preserves backend failures from nested product ownership lookups", async () => {
    const result = await productExistsInSalesChannel(
      upstreamFailure as typeof fetch,
      { adminApiToken: "secret", medusaInternalUrl: "http://medusa.test" },
      { productId: "prod_1", salesChannelId: "sc_1" },
    );

    assert.deepEqual(result, {
      error: "commerce_backend_error",
      ok: false,
      status: 502,
    });
  });
});
