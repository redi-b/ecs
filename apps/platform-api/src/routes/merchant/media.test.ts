import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MediaAsset } from "../../app.js";
import { createPlatformApp } from "../../app.js";
import type { TenantResolutionResult } from "../../tenancy/tenant-resolver.js";

const asset: MediaAsset = {
  accessMode: "public",
  altText: null,
  byteSize: 1_024,
  createdAt: "2026-07-11T00:00:00.000Z",
  displayName: "shoe.jpg",
  filename: "shoe.jpg",
  height: null,
  id: "asset_1",
  mimeType: "image/jpeg",
  publicUrl: "https://cdn.example.com/tenants/tenant_1/product/shoe.jpg",
  status: "pending",
  updatedAt: "2026-07-11T00:00:00.000Z",
  width: null,
};

describe("merchant media routes", () => {
  it("creates an upload inside the resolved merchant tenant", async () => {
    let receivedTenantId: string | undefined;
    const app = mediaApp({
      createMediaUpload: async (input) => {
        receivedTenantId = input.tenantId;
        return {
          asset,
          headers: { "content-type": input.mimeType },
          method: "PUT",
          objectKey: "tenants/tenant_1/product/pending/asset_1/shoe.jpg",
          ok: true,
          uploadUrl: "https://storage.example.com/upload",
        };
      },
    });

    const response = await app.request("http://shop.example.com/platform/merchant/media/uploads", {
      body: JSON.stringify({
        accessMode: "public",
        byteSize: 1_024,
        context: "product",
        filename: "shoe.jpg",
        mimeType: "image/jpeg",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    assert.equal(response.status, 201);
    assert.equal(receivedTenantId, "tenant_1");
  });

  it("does not expose an asset outside the resolved tenant", async () => {
    const app = mediaApp({
      deleteMediaAsset: async (input) =>
        input.tenantId === "tenant_1" && input.assetId === "asset_from_tenant_2"
          ? { error: "media_asset_not_found", ok: false, status: 404 }
          : { deleted: true, id: input.assetId, ok: true },
    });

    const response = await app.request(
      "http://shop.example.com/platform/merchant/media/asset_from_tenant_2",
      { method: "DELETE" },
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "media_asset_not_found" });
  });

  it("requires a merchant session before media access", async () => {
    const app = mediaApp({}, false);
    const response = await app.request("http://shop.example.com/platform/merchant/media");

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "auth_required" });
  });

  it("synchronizes ordered product media inside the resolved tenant", async () => {
    let received:
      | { imageUrls: string[]; productId: string; tenantId: string; thumbnail: string | null }
      | undefined;
    const app = mediaApp({
      syncProductMedia: async (input) => {
        received = input;
        return { count: input.imageUrls.length, ok: true };
      },
    });
    const response = await app.request(
      "http://shop.example.com/platform/merchant/media/products/prod_1",
      {
        body: JSON.stringify({
          imageUrls: ["https://cdn.example.com/one.jpg", "https://cdn.example.com/two.jpg"],
          thumbnail: "https://cdn.example.com/two.jpg",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(received, {
      imageUrls: ["https://cdn.example.com/one.jpg", "https://cdn.example.com/two.jpg"],
      productId: "prod_1",
      tenantId: "tenant_1",
      thumbnail: "https://cdn.example.com/two.jpg",
    });
  });
});

function mediaApp(
  mediaOptions: Pick<
    Parameters<typeof createPlatformApp>[0],
    "createMediaUpload" | "deleteMediaAsset" | "syncProductMedia"
  >,
  authenticated = true,
) {
  const resolution: TenantResolutionResult = {
    context: {
      domainId: "domain_1",
      hostname: "shop.example.com",
      medusaPublishableKeyId: "pk_1",
      medusaRegionId: "region_1",
      medusaSalesChannelId: "channel_1",
      medusaShippingOptionId: "so_1",
      medusaShippingProfileId: "shp_1",
      medusaStockLocationId: "stock_1",
      medusaStoreId: "store_1",
      publishedRevisionId: null,
      status: "active",
      templateId: null,
      templateKey: null,
      templateVersion: null,
      tenantHandle: "shop",
      tenantId: "tenant_1",
      tenantName: "Shop",
    },
    ok: true,
  };

  return createPlatformApp({
    ...mediaOptions,
    authorizeDashboardForTenant: async () => ({
      actor: { email: "owner@example.com", id: "user_1", name: "Owner", role: "owner" },
      ok: true,
    }),
    getSession: async () =>
      authenticated
        ? {
            session: { expiresAt: new Date(Date.now() + 60_000), id: "session_1" },
            user: { email: "owner@example.com", id: "user_1", name: "Owner" },
          }
        : null,
    medusaInternalUrl: "http://medusa:9000",
    platformPublicBaseUrl: "http://api.example.com",
    resolveTenantForHost: async () => resolution,
    serviceName: "platform-api",
  });
}
