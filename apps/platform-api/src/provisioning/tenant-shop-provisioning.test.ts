import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInitialTenantOnboardingState,
  createTenantShopProvisioner,
} from "./tenant-shop-provisioning.js";

describe("createTenantShopProvisioner", () => {
  it("builds the initial tenant onboarding state after commerce and template provisioning", () => {
    assert.deepEqual(buildInitialTenantOnboardingState(), {
      status: "in_progress",
      currentStep: "storefront_review",
      completedSteps: ["commerce_resources_provisioned", "storefront_template_preselected"],
    });
  });

  it("returns the existing tenant for a same-owner handle retry without provisioning commerce again", async () => {
    let commerceCalls = 0;
    const createTenantShop = createTenantShopProvisioner({
      createTenantShopRecord: async () => {
        throw new Error("should not create a duplicate tenant record");
      },
      findActiveStorefrontTemplate: async () => {
        throw new Error("should not load a template for an idempotent retry");
      },
      findExistingTenantByHandle: async (handle, ownerUserId) => {
        assert.equal(handle, "retry-shop");
        assert.equal(ownerUserId, "user_1");

        return {
          id: "tenant_1",
          name: "Retry Shop",
          handle: "retry-shop",
          status: "draft",
          primaryDomainHostname: "retry-shop.lvh.me",
          ownerUserId: "user_1",
        };
      },
      isDomainHostnameTaken: async () => {
        throw new Error("should not check domain availability for an existing tenant");
      },
      isHandleReserved: async () => false,
      platformBaseDomain: "lvh.me",
      provisionCommerceResources: async () => {
        commerceCalls += 1;

        return {
          ok: true,
          resources: {
            storeId: "store_1",
            salesChannelId: "sc_1",
            stockLocationId: "sloc_1",
            publishableKeyId: "apk_1",
          },
        };
      },
    });

    assert.deepEqual(
      await createTenantShop({
        handle: "retry-shop",
        name: "Retry Shop",
        ownerUserId: "user_1",
      }),
      {
        ok: true,
        tenant: {
          id: "tenant_1",
          name: "Retry Shop",
          handle: "retry-shop",
          status: "draft",
          primaryDomain: {
            hostname: "retry-shop.lvh.me",
          },
        },
      },
    );
    assert.equal(commerceCalls, 0);
  });
});
