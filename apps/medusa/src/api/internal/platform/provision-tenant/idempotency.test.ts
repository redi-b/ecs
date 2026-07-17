import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findExistingTenantCommerceResources } from "./idempotency";

describe("findExistingTenantCommerceResources", () => {
  it("returns an existing complete tenant commerce resource set", async () => {
    const calls: {
      entity: string;
      filters?: Record<string, unknown>;
    }[] = [];
    const idsByEntity = new Map([
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

    const result = await findExistingTenantCommerceResources({
      input: {
        handle: "abebe",
        name: "Abebe Market",
        platformTenantId: "tenant_1",
        requestedByUserId: "user_1",
      },
      query: {
        graph: async (input) => {
          calls.push(
            input.filters
              ? {
                  entity: input.entity,
                  filters: input.filters,
                }
              : {
                  entity: input.entity,
                },
          );

          const id = idsByEntity.get(input.entity);

          if (input.entity === "api_key" && id) {
            return {
              data: [{ id, token: "pk_test_token" }],
            };
          }

          return {
            data: id ? [{ id }] : [],
          };
        },
      },
    });

    assert.deepEqual(result, {
      storeId: "store_1",
      salesChannelId: "sc_1",
      stockLocationId: "sloc_1",
      publishableKeyId: "pk_test_token",
      regionId: "reg_1",
      shippingProfileId: "shp_1",
      fulfillmentSetId: "fuset_1",
      serviceZoneId: "serzo_1",
      shippingOptionId: "so_1",
    });
    assert.deepEqual(calls, [
      {
        entity: "store",
        filters: {
          metadata: {
            platform_tenant_id: "tenant_1",
          },
        },
      },
      {
        entity: "stock_location",
        filters: {
          metadata: {
            platform_tenant_id: "tenant_1",
          },
        },
      },
      {
        entity: "sales_channel",
        filters: {
          description: "Primary channel for abebe",
        },
      },
      {
        entity: "api_key",
        filters: {
          title: "Abebe Market Storefront",
          type: "publishable",
        },
      },
      {
        entity: "region",
        filters: {
          currency_code: "etb",
        },
      },
      {
        entity: "shipping_profile",
        filters: {
          name: "Abebe Market (abebe) Standard",
        },
      },
      {
        entity: "fulfillment_set",
        filters: {
          name: "Abebe Market (abebe) Shipping",
        },
      },
      {
        entity: "service_zone",
        filters: {
          name: "Abebe Market (abebe) Ethiopia",
        },
      },
      {
        entity: "shipping_option",
        filters: {
          provider_id: "manual_manual",
          service_zone_id: "serzo_1",
        },
      },
    ]);
  });

  it("returns undefined when the resource set is incomplete", async () => {
    const result = await findExistingTenantCommerceResources({
      input: {
        handle: "abebe",
        name: "Abebe Market",
        platformTenantId: "tenant_1",
        requestedByUserId: "user_1",
      },
      query: {
        graph: async (input) => ({
          data: input.entity === "store" ? [{ id: "store_1" }] : [],
        }),
      },
    });

    assert.equal(result, undefined);
  });

  it("returns undefined when api_key has only an id and no publishable token", async () => {
    const idsByEntity = new Map([
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

    const result = await findExistingTenantCommerceResources({
      input: {
        handle: "abebe",
        name: "Abebe Market",
        platformTenantId: "tenant_1",
        requestedByUserId: "user_1",
      },
      query: {
        graph: async (input) => {
          const id = idsByEntity.get(input.entity);
          // Token missing or id-shaped — must not fall back to apk_…
          if (input.entity === "api_key" && id) {
            return { data: [{ id }] };
          }
          return { data: id ? [{ id }] : [] };
        },
      },
    });

    assert.equal(result, undefined);
  });

  it("returns undefined when lookup fails", async () => {
    const result = await findExistingTenantCommerceResources({
      input: {
        handle: "abebe",
        name: "Abebe Market",
        platformTenantId: "tenant_1",
        requestedByUserId: "user_1",
      },
      query: {
        graph: async () => {
          throw new Error("lookup failed");
        },
      },
    });

    assert.equal(result, undefined);
  });
});
