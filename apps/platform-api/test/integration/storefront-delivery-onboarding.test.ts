import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, } from "../support/platform-app-harness.js";

describe("storefront delivery and onboarding", () => {
  it("returns delivery settings for an authorized tenant member", async () => {
    let deliveryInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
            ok: true,
            delivery: {
              tenantId: input.tenantId,
              deliveryEnabled: true,
              pickupEnabled: true,
              phoneConfirmationRequired: true,
              notesEnabled: true,
              landmarkRequired: false,
              defaultDeliveryFee: "50.00",
              currency: "ETB",
              zones: [
                {
                  name: "Bole",
                  fee: "75.00",
                },
              ],
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/delivery");

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      delivery: {
        tenantId: "tenant_1",
        deliveryEnabled: true,
        pickupEnabled: true,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: false,
        defaultDeliveryFee: "50.00",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });
  });

  it("updates delivery settings for an authorized tenant member", async () => {
    let deliveryInput:
      | {
          currency: string;
          defaultDeliveryFee: string;
          deliveryEnabled: boolean;
          landmarkRequired: boolean;
          notesEnabled: boolean;
          phoneConfirmationRequired: boolean;
          pickupEnabled: boolean;
          tenantId: string;
          userId: string;
          zones: unknown[];
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        updateDeliverySettings: async (input) => {
          deliveryInput = input;

          return {
            ok: true,
            delivery: {
              tenantId: input.tenantId,
              deliveryEnabled: input.deliveryEnabled,
              pickupEnabled: input.pickupEnabled,
              phoneConfirmationRequired: input.phoneConfirmationRequired,
              notesEnabled: input.notesEnabled,
              landmarkRequired: input.landmarkRequired,
              defaultDeliveryFee: input.defaultDeliveryFee,
              currency: input.currency,
              zones: input.zones,
              updatedAt: "2026-06-02T10:00:00.000Z",
            },
          };
        },
      },
    );

    const body = {
      deliveryEnabled: true,
      pickupEnabled: false,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: true,
      defaultDeliveryFee: 75,
      currency: " etb ",
      zones: [
        {
          name: "Bole",
          fee: "75.00",
        },
      ],
    };

    const response = await app.request("/platform/tenants/tenant_1/delivery", {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(deliveryInput, {
      tenantId: "tenant_1",
      userId: "user_1",
      deliveryEnabled: true,
      pickupEnabled: false,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: true,
      defaultDeliveryFee: "75",
      currency: "ETB",
      zones: [
        {
          name: "Bole",
          fee: "75.00",
        },
      ],
    });
    assert.deepEqual(await response.json(), {
      delivery: {
        tenantId: "tenant_1",
        deliveryEnabled: true,
        pickupEnabled: false,
        phoneConfirmationRequired: true,
        notesEnabled: true,
        landmarkRequired: true,
        defaultDeliveryFee: "75",
        currency: "ETB",
        zones: [
          {
            name: "Bole",
            fee: "75.00",
          },
        ],
        updatedAt: "2026-06-02T10:00:00.000Z",
      },
    });

    const bothOff = await app.request("/platform/tenants/tenant_1/delivery", {
      body: JSON.stringify({
        ...body,
        deliveryEnabled: false,
        pickupEnabled: false,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "PUT",
    });
    assert.equal(bothOff.status, 400);
    assert.deepEqual(await bothOff.json(), { error: "fulfillment_method_required" });
  });

  it("returns onboarding state for an authorized tenant member", async () => {
    let authorizationInput: { tenantId: string; userId: string } | undefined;
    let onboardingInput: { tenantId: string } | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authorizeDashboardForTenant: async (input) => {
          authorizationInput = input;

          return {
            ok: true,
            actor: {
              id: "user_1",
              email: "owner@abebe.local",
              name: "Abebe Owner",
              role: "owner",
            },
          };
        },
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantOnboarding: async (input) => {
          onboardingInput = input;

          return {
            ok: true,
            onboarding: {
              tenantId: input.tenantId,
              status: "in_progress",
              currentStep: "storefront_review",
              completedSteps: ["commerce_resources_provisioned", "storefront_template_preselected"],
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/onboarding");

    assert.equal(response.status, 200);
    assert.deepEqual(authorizationInput, {
      permission: { overview: ["read"] },
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(onboardingInput, {
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      onboarding: {
        tenantId: "tenant_1",
        status: "in_progress",
        currentStep: "storefront_review",
        completedSteps: ["commerce_resources_provisioned", "storefront_template_preselected"],
      },
    });
  });
});
