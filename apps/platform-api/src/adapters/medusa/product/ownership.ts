import { getAdminHeaders, requestMedusa } from "./medusa-http.js";
import { belongsToTenant } from "./normalize.js";
import {
  getProductOwnershipListUrl,
  getProductOwnershipUrl,
  getProductsBaseUrl,
  normalizeBaseUrl,
} from "./urls.js";
import { getBoolean, getString, isMissingCommerceResourceResponse, isRecord } from "./values.js";

export function productBelongsToSalesChannel(product: unknown, salesChannelId: string) {
  if (!isRecord(product) || !Array.isArray(product.sales_channels)) {
    return undefined;
  }

  const salesChannelIds = product.sales_channels.flatMap((salesChannel) => {
    if (!isRecord(salesChannel)) {
      return [];
    }

    const id = getString(salesChannel.id);

    return id ? [id] : [];
  });

  if (salesChannelIds.length === 0) {
    return undefined;
  }

  return salesChannelIds.includes(salesChannelId);
}

export async function productIsInSalesChannel(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: { product: unknown; productId: string; salesChannelId: string },
) {
  const ownership = productBelongsToSalesChannel(input.product, input.salesChannelId);

  if (ownership !== undefined) {
    return ownership;
  }

  return productExistsInSalesChannel(fetcher, options, {
    productId: input.productId,
    salesChannelId: input.salesChannelId,
  });
}

export async function productExistsInSalesChannel(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: { productId: string; salesChannelId: string },
) {
  const response = await requestMedusa(
    fetcher,
    getProductOwnershipListUrl(options.medusaInternalUrl, input),
    {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
    },
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json().catch(() => undefined);

  return Array.isArray(data?.products)
    ? data.products.some((product: unknown) => isRecord(product) && product.id === input.productId)
    : false;
}

export async function categoryBelongsToTenantById(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  categoryId: string,
  tenantId: string,
): Promise<
  | boolean
  | {
      ok: false;
      error: "commerce_credentials_invalid" | "commerce_backend_unavailable";
      status: 401 | 503;
    }
> {
  const url = new URL(
    `/admin/product-categories/${encodeURIComponent(categoryId)}`,
    normalizeBaseUrl(options.medusaInternalUrl),
  );
  url.searchParams.set("fields", "id,metadata");

  const response = await requestMedusa(fetcher, url, {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  const data = await response.json().catch(() => undefined);
  return belongsToTenant(data?.product_category, tenantId);
}

export async function collectionBelongsToTenantById(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  collectionId: string,
  tenantId: string,
): Promise<
  | boolean
  | {
      ok: false;
      error: "commerce_credentials_invalid" | "commerce_backend_unavailable";
      status: 401 | 503;
    }
> {
  const url = new URL(
    `/admin/collections/${encodeURIComponent(collectionId)}`,
    normalizeBaseUrl(options.medusaInternalUrl),
  );
  url.searchParams.set("fields", "id,metadata");

  const response = await requestMedusa(fetcher, url, {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  const data = await response.json().catch(() => undefined);
  return belongsToTenant(data?.collection, tenantId);
}

export async function filterProductIdsBySalesChannel(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  productIds: string[],
  salesChannelId: string,
): Promise<
  | string[]
  | {
      ok: false;
      error: "commerce_credentials_invalid" | "commerce_backend_unavailable";
      status: 401 | 503;
    }
> {
  if (productIds.length === 0) {
    return [];
  }

  const url = getProductsBaseUrl(options.medusaInternalUrl);
  url.searchParams.set("limit", String(productIds.length));
  url.searchParams.set("offset", "0");
  url.searchParams.set("fields", "id");
  url.searchParams.set("sales_channel_id[]", salesChannelId);
  for (const id of productIds) {
    url.searchParams.append("id[]", id);
  }

  const response = await requestMedusa(fetcher, url, {
    headers: getAdminHeaders(options.adminApiToken ?? ""),
  });

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  const data = await response.json().catch(() => undefined);
  if (!data || !Array.isArray(data.products)) {
    return [];
  }

  return data.products
    .map((p: any) => getString(p.id))
    .filter((id: string | null): id is string => Boolean(id));
}
