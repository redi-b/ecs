import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectTenantCommerceResources } from "./idempotency";

const input = {
  handle: "abebe",
  name: "Abebe Market",
  platformTenantId: "tenant_1",
  requestedByUserId: "user_1",
};

const completeIds = new Map([
  ["store", "store_1"],
  ["stock_location", "sloc_1"],
  ["sales_channel", "sc_1"],
  ["api_key", "apk_1"],
  ["region", "reg_1"],
  ["shipping_profile", "shp_1"],
  ["fulfillment_set", "fuset_1"],
  ["service_zone", "serzo_1"],
  ["shipping_option", "so_1"],
]);

describe("inspectTenantCommerceResources", () => {
  it("returns an existing complete resource set", async () => {
    const result = await inspectTenantCommerceResources({
      input,
      query: {
        graph: async ({ entity }) => {
          const id = completeIds.get(entity);
          if (entity === "api_key" && id) return { data: [{ id, token: "pk_test_token" }] };
          return { data: id ? [{ id }] : [] };
        },
      },
    });

    assert.deepEqual(result, {
      state: "complete",
      resources: {
        storeId: "store_1",
        salesChannelId: "sc_1",
        stockLocationId: "sloc_1",
        publishableKeyId: "pk_test_token",
        regionId: "reg_1",
        shippingProfileId: "shp_1",
        fulfillmentSetId: "fuset_1",
        serviceZoneId: "serzo_1",
        shippingOptionId: "so_1",
      },
    });
  });

  it("treats a shared region without tenant-owned resources as a fresh tenant", async () => {
    const result = await inspectTenantCommerceResources({
      input,
      query: {
        graph: async ({ entity }) => ({ data: entity === "region" ? [{ id: "reg_1" }] : [] }),
      },
    });
    assert.deepEqual(result, { state: "missing" });
  });

  it("fails closed when any tenant-owned resource exists but the set is incomplete", async () => {
    const result = await inspectTenantCommerceResources({
      input,
      query: {
        graph: async ({ entity }) => ({ data: entity === "store" ? [{ id: "store_1" }] : [] }),
      },
    });
    assert.equal(result.state, "partial");
    if (result.state === "partial") {
      assert.ok(result.missing.includes("salesChannelId"));
      assert.ok(result.missing.includes("publishableKeyId"));
    }
  });

  it("recognizes an API key row without a usable token as partial state", async () => {
    const result = await inspectTenantCommerceResources({
      input,
      query: {
        graph: async ({ entity }) => {
          const id = completeIds.get(entity);
          if (entity === "api_key" && id) return { data: [{ id }] };
          return { data: id ? [{ id }] : [] };
        },
      },
    });
    assert.deepEqual(result, { state: "partial", missing: ["publishableKeyId"] });
  });

  it("fails closed when resource lookup is unavailable", async () => {
    const result = await inspectTenantCommerceResources({
      input,
      query: {
        graph: async () => {
          throw new Error("lookup failed");
        },
      },
    });
    assert.deepEqual(result, { state: "unavailable" });
  });
});
