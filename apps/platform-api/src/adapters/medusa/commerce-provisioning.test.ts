import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createMedusaCommerceProvisioningClient } from "./commerce-provisioning.js";

describe("createMedusaCommerceProvisioningClient", () => {
  it("calls the Medusa internal provisioning endpoint with the platform token", async () => {
    const calls: {
      body: unknown;
      headers: Headers;
      url: string;
    }[] = [];
    const provisionCommerceResources = createMedusaCommerceProvisioningClient({
      internalApiToken: "internal-token",
      medusaInternalUrl: "http://medusa:9000/",
      fetch: async (url, init) => {
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
        });

        return Response.json(
          {
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
          },
          {
            status: 201,
          },
        );
      },
    });

    const result = await provisionCommerceResources({
      handle: "abebe",
      name: "Abebe Market",
      platformTenantId: "tenant_1",
      requestedByUserId: "user_1",
    });

    assert.deepEqual(result, {
      ok: true,
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
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "http://medusa:9000/internal/platform/provision-tenant");
    assert.equal(calls[0]?.headers.get("x-platform-internal-token"), "internal-token");
    assert.deepEqual(calls[0]?.body, {
      handle: "abebe",
      name: "Abebe Market",
      platformTenantId: "tenant_1",
      requestedByUserId: "user_1",
    });
  });

  it("fails closed when the internal token is missing", async () => {
    const provisionCommerceResources = createMedusaCommerceProvisioningClient({
      internalApiToken: undefined,
      medusaInternalUrl: "http://medusa:9000",
      fetch: async () => {
        throw new Error("should not call Medusa without the internal token");
      },
    });

    assert.deepEqual(
      await provisionCommerceResources({
        handle: "abebe",
        name: "Abebe Market",
        platformTenantId: "tenant_1",
        requestedByUserId: "user_1",
      }),
      {
        ok: false,
        error: "commerce_backend_unavailable",
      },
    );
  });

  it("fails closed when publishableKeyId is an api_key id (apk_) instead of a token (pk_)", async () => {
    const provisionCommerceResources = createMedusaCommerceProvisioningClient({
      internalApiToken: "internal-token",
      medusaInternalUrl: "http://medusa:9000",
      fetch: async () =>
        Response.json(
          {
            resources: {
              storeId: "store_1",
              salesChannelId: "sc_1",
              stockLocationId: "sloc_1",
              publishableKeyId: "apk_1",
              regionId: "reg_1",
              shippingProfileId: "shp_1",
              fulfillmentSetId: "fuset_1",
              serviceZoneId: "serzo_1",
              shippingOptionId: "so_1",
            },
          },
          { status: 201 },
        ),
    });

    assert.deepEqual(
      await provisionCommerceResources({
        handle: "abebe",
        name: "Abebe Market",
        platformTenantId: "tenant_1",
        requestedByUserId: "user_1",
      }),
      {
        ok: false,
        error: "commerce_backend_unavailable",
      },
    );
  });
});
