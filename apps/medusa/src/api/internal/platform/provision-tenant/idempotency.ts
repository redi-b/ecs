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

  // Store facade needs the publishable token (pk_…), never the api_key row id (apk_…).
  const publishableKeyId = await findPublishableKeyToken(query, {
    title: `${input.name} Storefront`,
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

async function findPublishableKeyToken(
  query: QueryGraph,
  input: {
    title: string;
  },
) {
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: {
      title: input.title,
      type: "publishable",
    },
    pagination: {
      take: 1,
      skip: 0,
    },
  });

  const [row] = data;
  if (!isRecord(row)) {
    return undefined;
  }

  if (typeof row.token === "string" && row.token.trim()) {
    const token = row.token.trim();
    // Never return apk_ ids — store facade requires the publishable token.
    if (token.startsWith("apk_")) {
      return undefined;
    }
    return token;
  }

  // Do not fall back to api_key id (apk_…): Medusa Store API rejects it.
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
