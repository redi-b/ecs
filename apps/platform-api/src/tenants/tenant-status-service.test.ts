import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantReadiness } from "./tenant-status-service.js";

describe("buildTenantReadiness", () => {
  it("includes the latest failed provisioning attempt in readiness", () => {
    assert.deepEqual(
      buildTenantReadiness({
        id: "tenant_1",
        name: "Abebe Market",
        handle: "abebe",
        status: "active",
        primaryDomainId: "domain_1",
        primaryDomainStatus: "active",
        primaryDomainVerificationStatus: "verified",
        medusaStoreId: null,
        medusaSalesChannelId: null,
        medusaPublishableKeyId: null,
        medusaRegionId: null,
        medusaShippingOptionId: null,
        draftTemplateId: "template_1",
        publishedRevisionId: null,
        latestProvisioningAttempt: {
          id: "attempt_1",
          completedAt: "2026-06-30T08:00:00.000Z",
          error: "commerce_backend_unavailable",
          status: "failed",
          step: "commerce_resources",
        },
      }),
      {
        ready: false,
        missing: [
          "commerce_store_missing",
          "commerce_sales_channel_missing",
          "commerce_publishable_key_missing",
          "commerce_region_missing",
          "commerce_shipping_option_missing",
          "storefront_unpublished",
          "provisioning_failed",
        ],
        tenant: {
          id: "tenant_1",
          name: "Abebe Market",
          handle: "abebe",
          status: "active",
        },
        checks: {
          tenant: {
            ready: true,
            missing: [],
            isActive: true,
          },
          domain: {
            ready: true,
            missing: [],
            hasPrimaryDomain: true,
            isActive: true,
            isVerified: true,
          },
          commerce: {
            ready: false,
            missing: [
              "commerce_store_missing",
              "commerce_sales_channel_missing",
              "commerce_publishable_key_missing",
              "commerce_region_missing",
              "commerce_shipping_option_missing",
            ],
            hasStore: false,
            hasSalesChannel: false,
            hasPublishableKey: false,
            hasRegion: false,
            hasShippingOption: false,
          },
          storefront: {
            ready: false,
            missing: ["storefront_unpublished"],
            hasDraft: true,
            isPublished: false,
          },
          provisioning: {
            ready: false,
            missing: ["provisioning_failed"],
            latestAttempt: {
              id: "attempt_1",
              completedAt: "2026-06-30T08:00:00.000Z",
              error: "commerce_backend_unavailable",
              status: "failed",
              step: "commerce_resources",
            },
          },
        },
      },
    );
  });
});
