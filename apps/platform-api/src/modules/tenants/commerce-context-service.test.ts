import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantCommerceContext } from "./commerce-context-service.js";

const completeRow = {
  id: "tenant_1",
  medusaStoreId: "store_1",
  medusaSalesChannelId: "sc_1",
  medusaStockLocationId: "sloc_1",
  medusaPublishableKeyId: "pk_1",
  medusaRegionId: "reg_1",
};

describe("buildTenantCommerceContext", () => {
  it("returns a complete tenant commerce context", () => {
    assert.deepEqual(buildTenantCommerceContext(completeRow), {
      ok: true,
      context: {
        tenantId: "tenant_1",
        medusaStoreId: "store_1",
        medusaSalesChannelId: "sc_1",
        medusaStockLocationId: "sloc_1",
        medusaPublishableKeyId: "pk_1",
        medusaRegionId: "reg_1",
      },
    });
  });

  it("returns tenant_not_found when the tenant row is missing", () => {
    assert.deepEqual(buildTenantCommerceContext(undefined), {
      ok: false,
      error: "tenant_not_found",
      status: 404,
    });
  });

  it("returns specific errors for incomplete tenant commerce resources", () => {
    assert.deepEqual(buildTenantCommerceContext({ ...completeRow, medusaStoreId: null }), {
      ok: false,
      error: "commerce_store_unavailable",
      status: 503,
    });
    assert.deepEqual(buildTenantCommerceContext({ ...completeRow, medusaSalesChannelId: null }), {
      ok: false,
      error: "commerce_sales_channel_unavailable",
      status: 503,
    });
    assert.deepEqual(buildTenantCommerceContext({ ...completeRow, medusaStockLocationId: null }), {
      ok: false,
      error: "inventory_location_unavailable",
      status: 503,
    });
    assert.deepEqual(buildTenantCommerceContext({ ...completeRow, medusaPublishableKeyId: null }), {
      ok: false,
      error: "commerce_publishable_key_unavailable",
      status: 503,
    });
    assert.deepEqual(buildTenantCommerceContext({ ...completeRow, medusaRegionId: null }), {
      ok: false,
      error: "commerce_region_unavailable",
      status: 503,
    });
  });
});
