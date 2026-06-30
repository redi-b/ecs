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
            regionId: "reg_1",
            shippingProfileId: "shp_1",
            fulfillmentSetId: "fuset_1",
            serviceZoneId: "serzo_1",
            shippingOptionId: "so_1",
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

  it("records tenant.created analytics after creating a new tenant shop", async () => {
    let createdTenantId: string | undefined;
    const analyticsEvents: {
      eventType: string;
      idempotencyKey?: string | null | undefined;
      properties?: unknown;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }[] = [];
    const createTenantShop = createTenantShopProvisioner({
      createTenantShopRecord: async (input) => {
        createdTenantId = input.tenantId;

        return {
          id: input.tenantId,
          name: input.name,
          handle: input.handle,
          status: "draft",
          primaryDomain: {
            hostname: input.hostname,
          },
        };
      },
      findActiveStorefrontTemplate: async () => ({
        templateId: "template_1",
        templateVersion: 1,
        defaultData: {},
        defaultThemeTokens: {},
      }),
      findExistingTenantByHandle: async () => undefined,
      isDomainHostnameTaken: async () => false,
      isHandleReserved: async () => false,
      platformBaseDomain: "lvh.me",
      provisionCommerceResources: async (input) => ({
        ok: true,
        resources: {
          storeId: `store_${input.platformTenantId}`,
          salesChannelId: "sc_1",
          stockLocationId: "sloc_1",
          publishableKeyId: "apk_1",
          regionId: "reg_1",
          shippingProfileId: "shp_1",
          fulfillmentSetId: "fuset_1",
          serviceZoneId: "serzo_1",
          shippingOptionId: "so_1",
        },
      }),
      recordAnalyticsEvent: async (input) => {
        analyticsEvents.push(input);

        return {
          ok: true,
          duplicate: false,
          event: {
            id: "event_1",
            eventType: input.eventType,
            occurredAt: "2026-01-01T12:00:00.000Z",
            receivedAt: "2026-01-01T12:00:01.000Z",
            source: input.source,
          },
        };
      },
    });

    const result = await createTenantShop({
      handle: " New-Shop ",
      name: " New Shop ",
      ownerUserId: "user_1",
    });

    assert.equal(result.ok, true);
    assert.ok(createdTenantId);
    assert.deepEqual(analyticsEvents, [
      {
        eventType: "tenant.created",
        idempotencyKey: `tenant:${createdTenantId}:tenant.created`,
        properties: {
          handle: "new-shop",
          hostname: "new-shop.lvh.me",
          medusaPublishableKeyId: "apk_1",
          medusaRegionId: "reg_1",
          medusaSalesChannelId: "sc_1",
          medusaShippingOptionId: "so_1",
          medusaStoreId: `store_${createdTenantId}`,
          ownerUserId: "user_1",
        },
        source: "platform",
        subjectId: createdTenantId,
        subjectType: "tenant",
        tenantId: createdTenantId,
      },
    ]);
  });
});
