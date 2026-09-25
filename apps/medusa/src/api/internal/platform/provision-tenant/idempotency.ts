import type {
  ProvisionTenantCommerceResourcesInput,
  ProvisionTenantCommerceResourcesOutput,
} from "../../../../workflows/provision-tenant-commerce-resources";

type QueryGraph = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
    pagination?: { take?: number; skip?: number };
  }) => Promise<{ data: unknown[] }>;
};

type ExistingResourceLookup = {
  query: QueryGraph;
  input: ProvisionTenantCommerceResourcesInput;
};

export type TenantCommerceResourceLookup =
  | { state: "complete"; resources: ProvisionTenantCommerceResourcesOutput }
  | { state: "missing" }
  | { state: "partial"; missing: string[] }
  | { state: "unavailable" };

export async function inspectTenantCommerceResources({
  input,
  query,
}: ExistingResourceLookup): Promise<TenantCommerceResourceLookup> {
  try {
    return await inspectTenantCommerceResourcesUnsafe({ input, query });
  } catch {
    return { state: "unavailable" };
  }
}

async function inspectTenantCommerceResourcesUnsafe({
  input,
  query,
}: ExistingResourceLookup): Promise<TenantCommerceResourceLookup> {
  const storeId = await findOneId(query, {
    entity: "store",
    filters: { metadata: { platform_tenant_id: input.platformTenantId } },
  });
  const stockLocationId = await findOneId(query, {
    entity: "stock_location",
    filters: { metadata: { platform_tenant_id: input.platformTenantId } },
  });
  const salesChannelId = await findOneId(query, {
    entity: "sales_channel",
    filters: { description: `Primary channel for ${input.handle}` },
  });
  const publishableKey = await findPublishableKey(query, {
    title: `${input.name} Storefront`,
  });
  const regionId = await findOneId(query, {
    entity: "region",
    filters: { currency_code: "etb" },
  });
  const shippingProfileId = await findOneId(query, {
    entity: "shipping_profile",
    filters: { name: `${input.name} (${input.handle}) Standard` },
  });
  const fulfillmentSetId = await findOneId(query, {
    entity: "fulfillment_set",
    filters: { name: `${input.name} (${input.handle}) Shipping` },
  });
  const serviceZoneId = await findOneId(query, {
    entity: "service_zone",
    filters: { name: `${input.name} (${input.handle}) Ethiopia` },
  });
  const shippingOptionId = serviceZoneId
    ? await findOneId(query, {
        entity: "shipping_option",
        filters: { provider_id: "manual_manual", service_zone_id: serviceZoneId },
      })
    : undefined;

  const tenantOwned = [
    storeId,
    stockLocationId,
    salesChannelId,
    publishableKey.present ? "present" : undefined,
    shippingProfileId,
    fulfillmentSetId,
    serviceZoneId,
    shippingOptionId,
  ];
  if (tenantOwned.every((value) => value === undefined)) return { state: "missing" };

  const resources = {
    storeId,
    salesChannelId,
    stockLocationId,
    publishableKeyId: publishableKey.token,
    regionId,
    shippingProfileId,
    fulfillmentSetId,
    serviceZoneId,
    shippingOptionId,
  };
  const missing = Object.entries(resources)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) return { state: "partial", missing };

  return {
    state: "complete",
    resources: resources as ProvisionTenantCommerceResourcesOutput,
  };
}

async function findOneId(
  query: QueryGraph,
  input: { entity: string; filters: Record<string, unknown> },
) {
  const { data } = await query.graph({
    entity: input.entity,
    fields: ["id"],
    filters: input.filters,
    pagination: { take: 1, skip: 0 },
  });
  const [row] = data;
  return isRecord(row) && typeof row.id === "string" ? row.id : undefined;
}

async function findPublishableKey(query: QueryGraph, input: { title: string }) {
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { title: input.title, type: "publishable" },
    pagination: { take: 1, skip: 0 },
  });
  const [row] = data;
  if (!isRecord(row)) return { present: false, token: undefined } as const;
  const token = typeof row.token === "string" ? row.token.trim() : "";
  return {
    present: true,
    token: token && !token.startsWith("apk_") ? token : undefined,
  } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
