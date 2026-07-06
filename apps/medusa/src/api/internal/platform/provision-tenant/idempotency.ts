import type {
  ProvisionTenantCommerceResourcesInput,
  ProvisionTenantCommerceResourcesOutput,
} from "../../../../workflows/provision-tenant-commerce-resources";

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
    pagination?: {
      take?: number;
      skip?: number;
    };
  }) => Promise<{ data: unknown[] }>;
};

type ExistingResourceLookup = {
  query: QueryGraph;
  input: ProvisionTenantCommerceResourcesInput;
};

export async function findExistingTenantCommerceResources({
  input,
  query,
}: ExistingResourceLookup): Promise<ProvisionTenantCommerceResourcesOutput | undefined> {
  try {
    return await findExistingTenantCommerceResourcesUnsafe({ input, query });
  } catch {
    return undefined;
  }
}

async function findExistingTenantCommerceResourcesUnsafe({
  input,
  query,
}: ExistingResourceLookup): Promise<ProvisionTenantCommerceResourcesOutput | undefined> {
  const storeId = await findOneId(query, {
    entity: "store",
    filters: {
      metadata: {
        platform_tenant_id: input.platformTenantId,
      },
    },
  });

  const stockLocationId = await findOneId(query, {
    entity: "stock_location",
    filters: {
      metadata: {
        platform_tenant_id: input.platformTenantId,
      },
    },
  });

  const salesChannelId = await findOneId(query, {
    entity: "sales_channel",
    filters: {
      description: `Primary channel for ${input.handle}`,
    },
  });

  const publishableKeyId = await findOneId(query, {
    entity: "api_key",
    filters: {
      title: `${input.name} Storefront`,
      type: "publishable",
    },
  });

  const regionId = await findOneId(query, {
    entity: "region",
    filters: {
      currency_code: "etb",
    },
  });

  const shippingProfileId = await findOneId(query, {
    entity: "shipping_profile",
    filters: {
      name: `${input.name} (${input.handle}) Standard`,
    },
  });

  const fulfillmentSetId = await findOneId(query, {
    entity: "fulfillment_set",
    filters: {
      name: `${input.name} (${input.handle}) Shipping`,
    },
  });

  const serviceZoneId = await findOneId(query, {
    entity: "service_zone",
    filters: {
      name: `${input.name} (${input.handle}) Ethiopia`,
    },
  });

  const shippingOptionId = serviceZoneId
    ? await findOneId(query, {
        entity: "shipping_option",
        filters: {
          provider_id: "manual_manual",
          service_zone_id: serviceZoneId,
        },
      })
    : undefined;

  if (
    !storeId ||
    !salesChannelId ||
    !stockLocationId ||
    !publishableKeyId ||
    !regionId ||
    !shippingProfileId ||
    !fulfillmentSetId ||
    !serviceZoneId ||
    !shippingOptionId
  ) {
    return undefined;
  }

  return {
    fulfillmentSetId,
    publishableKeyId,
    regionId,
    salesChannelId,
    serviceZoneId,
    shippingOptionId,
    shippingProfileId,
    stockLocationId,
    storeId,
  };
}

async function findOneId(
  query: QueryGraph,
  input: {
    entity: string;
    filters: Record<string, unknown>;
  },
) {
  const { data } = await query.graph({
    entity: input.entity,
    fields: ["id"],
    filters: input.filters,
    pagination: {
      take: 1,
      skip: 0,
    },
  });

  const [row] = data;

  if (!isRecord(row) || typeof row.id !== "string") {
    return undefined;
  }

  return row.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
