import { Modules } from "@medusajs/framework/utils";
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
  batchLinksWorkflow,
  createApiKeysWorkflow,
  createFulfillmentSets,
  createSalesChannelsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows";

export type ProvisionTenantCommerceResourcesInput = {
  handle: string;
  name: string;
  platformTenantId: string;
  requestedByUserId: string;
};

export type ProvisionTenantCommerceResourcesOutput = {
  storeId: string;
  salesChannelId: string;
  stockLocationId: string;
  publishableKeyId: string;
  regionId: string;
  shippingProfileId: string;
  fulfillmentSetId: string;
  serviceZoneId: string;
  shippingOptionId: string;
};

function requireFirst<T>(values: T[], resourceName: string): T {
  const [value] = values;

  if (!value) {
    throw new Error(`${resourceName} provisioning returned no resources.`);
  }

  return value;
}

// biome-ignore-start lint/complexity/useArrowFunction: Medusa workflow composition requires a regular function.
export const provisionTenantCommerceResourcesWorkflow = createWorkflow(
  "provision-tenant-commerce-resources",
  function (input: ProvisionTenantCommerceResourcesInput) {
    const storeInput = transform({ input }, (data) => ({
      stores: [
        {
          name: data.input.name,
          supported_currencies: [
            {
              currency_code: "etb",
              is_default: true,
            },
          ],
          metadata: {
            platform_tenant_id: data.input.platformTenantId,
            platform_handle: data.input.handle,
          },
        },
      ],
    }));

    const stores = createStoresWorkflow.runAsStep({
      input: storeInput,
    });

    const { data: regions } = useQueryGraphStep({
      entity: "region",
      fields: ["id"],
      filters: {
        currency_code: "etb",
      },
    });

    const salesChannelInput = transform({ input }, (data) => ({
      salesChannelsData: [
        {
          name: data.input.name,
          description: `Primary channel for ${data.input.handle}`,
        },
      ],
    }));

    const salesChannels = createSalesChannelsWorkflow.runAsStep({
      input: salesChannelInput,
    });

    const stockLocationInput = transform({ input }, (data) => ({
      locations: [
        {
          name: `${data.input.name} (${data.input.handle}) Stock`,
          metadata: {
            platform_tenant_id: data.input.platformTenantId,
            platform_handle: data.input.handle,
          },
        },
      ],
    }));

    const stockLocations = createStockLocationsWorkflow.runAsStep({
      input: stockLocationInput,
    });

    const shippingProfileInput = transform({ input }, (data) => ({
      data: [
        {
          name: `${data.input.name} (${data.input.handle}) Standard`,
          type: "default",
        },
      ],
    }));

    const shippingProfiles = createShippingProfilesWorkflow.runAsStep({
      input: shippingProfileInput,
    });

    const fulfillmentSetInput = transform({ input }, (data) => [
      {
        name: `${data.input.name} (${data.input.handle}) Shipping`,
        type: "shipping",
      },
    ]);

    const fulfillmentSets = createFulfillmentSets(fulfillmentSetInput);

    const stockLocationFulfillmentLinkInput = transform(
      { fulfillmentSets, stockLocations },
      (data) => ({
        create: [
          {
            [Modules.STOCK_LOCATION]: {
              stock_location_id: requireFirst(data.stockLocations, "Stock location").id,
            },
            [Modules.FULFILLMENT]: {
              fulfillment_set_id: requireFirst(data.fulfillmentSets, "Fulfillment set").id,
            },
          },
          {
            [Modules.STOCK_LOCATION]: {
              stock_location_id: requireFirst(data.stockLocations, "Stock location").id,
            },
            [Modules.FULFILLMENT]: {
              fulfillment_provider_id: "manual_manual",
            },
          },
        ],
      }),
    );

    batchLinksWorkflow.runAsStep({
      input: stockLocationFulfillmentLinkInput,
    });

    const serviceZoneInput = transform({ fulfillmentSets, input }, (data) => ({
      data: [
        {
          name: `${data.input.name} (${data.input.handle}) Ethiopia`,
          fulfillment_set_id: requireFirst(data.fulfillmentSets, "Fulfillment set").id,
          geo_zones: [
            {
              type: "country" as const,
              country_code: "et",
            },
          ],
        },
      ],
    }));

    const serviceZones = createServiceZonesWorkflow.runAsStep({
      input: serviceZoneInput,
    });

    const shippingOptionInput = transform({ serviceZones, shippingProfiles }, (data) => [
      {
        name: "Local Delivery",
        service_zone_id: requireFirst(data.serviceZones, "Service zone").id,
        shipping_profile_id: requireFirst(data.shippingProfiles, "Shipping profile").id,
        provider_id: "manual_manual",
        type: {
          label: "Local Delivery",
          description: "Manual local delivery",
          code: "local_delivery",
        },
        price_type: "flat" as const,
        prices: [
          {
            amount: 50,
            currency_code: "etb",
          },
        ],
      },
    ]);

    const shippingOptions = createShippingOptionsWorkflow.runAsStep({
      input: shippingOptionInput,
    });

    const apiKeyInput = transform({ input }, (data) => ({
      api_keys: [
        {
          title: `${data.input.name} Storefront`,
          type: "publishable" as const,
          created_by: data.input.requestedByUserId,
        },
      ],
    }));

    const apiKeys = createApiKeysWorkflow.runAsStep({
      input: apiKeyInput,
    });

    const apiKeyLinkInput = transform({ apiKeys, salesChannels }, (data) => ({
      id: requireFirst(data.apiKeys, "API key").id,
      add: [requireFirst(data.salesChannels, "Sales channel").id],
      remove: [],
    }));

    linkSalesChannelsToApiKeyWorkflow.runAsStep({
      input: apiKeyLinkInput,
    });

    const stockLocationLinkInput = transform({ stockLocations, salesChannels }, (data) => ({
      id: requireFirst(data.stockLocations, "Stock location").id,
      add: [requireFirst(data.salesChannels, "Sales channel").id],
      remove: [],
    }));

    linkSalesChannelsToStockLocationWorkflow.runAsStep({
      input: stockLocationLinkInput,
    });

    const result = transform(
      {
        apiKeys,
        fulfillmentSets,
        regions,
        salesChannels,
        serviceZones,
        shippingOptions,
        shippingProfiles,
        stockLocations,
        stores,
      },
      (data): ProvisionTenantCommerceResourcesOutput => ({
        storeId: requireFirst(data.stores, "Store").id,
        salesChannelId: requireFirst(data.salesChannels, "Sales channel").id,
        stockLocationId: requireFirst(data.stockLocations, "Stock location").id,
        // Store API requires the publishable *token* (pk_…), never the row id (apk_…).
        // Platform injects this value as x-publishable-api-key on /store/* facade calls.
        publishableKeyId: (() => {
          const key = requireFirst(data.apiKeys, "API key") as {
            id?: string;
            token?: string;
          };
          const token = typeof key.token === "string" ? key.token.trim() : "";
          if (!token) {
            throw new Error(
              "Publishable API key token missing after create. Refusing to store api_key id.",
            );
          }
          if (token.startsWith("apk_")) {
            throw new Error("Publishable API key resolved to an id (apk_…); expected token (pk_…).");
          }
          return token;
        })(),
        regionId: requireFirst(data.regions, "Region").id,
        shippingProfileId: requireFirst(data.shippingProfiles, "Shipping profile").id,
        fulfillmentSetId: requireFirst(data.fulfillmentSets, "Fulfillment set").id,
        serviceZoneId: requireFirst(data.serviceZones, "Service zone").id,
        shippingOptionId: requireFirst(data.shippingOptions, "Shipping option").id,
      }),
    );

    return new WorkflowResponse(result);
  },
);
// biome-ignore-end lint/complexity/useArrowFunction: Medusa workflow composition requires a regular function.
