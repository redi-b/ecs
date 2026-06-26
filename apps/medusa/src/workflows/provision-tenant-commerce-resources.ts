import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
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
};

function requireFirst<T>(values: T[], resourceName: string): T {
  const [value] = values;

  if (!value) {
    throw new Error(`${resourceName} provisioning returned no resources.`);
  }

  return value;
}

export const provisionTenantCommerceResourcesWorkflow = createWorkflow(
  "provision-tenant-commerce-resources",
  (input: ProvisionTenantCommerceResourcesInput) => {
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
          name: `${data.input.name} Stock`,
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
      { apiKeys, salesChannels, stockLocations, stores },
      (data): ProvisionTenantCommerceResourcesOutput => ({
        storeId: requireFirst(data.stores, "Store").id,
        salesChannelId: requireFirst(data.salesChannels, "Sales channel").id,
        stockLocationId: requireFirst(data.stockLocations, "Stock location").id,
        publishableKeyId: requireFirst(data.apiKeys, "API key").id,
      }),
    );

    return new WorkflowResponse(result);
  },
);
