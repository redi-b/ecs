import { normalizeBaseUrl } from "@/lib/platform-api/client";
import {
  fetchProductResource,
  parseBatchDeleteResponse,
  parseDeleteResponse,
  parseProductCategoriesResponse,
  parseProductCategoryMutationResponse,
  parseProductCollectionMutationResponse,
  parseProductCollectionsResponse,
  sendTaxonomyMutation,
} from "./shared";
import type {
  MerchantBatchDeleteActionResult,
  MerchantDeleteActionResult,
  MerchantProductCategoriesResult,
  MerchantProductCategoryMutationResult,
  MerchantProductCollectionMutationResult,
  MerchantProductCollectionsResult,
} from "./types";
import { getProductHeaders, getProductResourceMutationUrl, getProductResourceUrl } from "./urls";

export async function createMerchantProductCategory(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  handle?: string | null | undefined;
  name: string;
  parentCategoryId?: string | null | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
  visibility?: "public" | "hidden" | undefined;
}): Promise<MerchantProductCategoryMutationResult> {
  const response = await sendTaxonomyMutation({
    body: {
      name: options.name,
      handle: options.handle,
      ...(options.parentCategoryId ? { parentCategoryId: options.parentCategoryId } : {}),
      ...(options.visibility ? { visibility: options.visibility } : {}),
    },
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
    resource: "product-categories",
    tenantId: options.tenantId,
  });

  return parseProductCategoryMutationResponse(response);
}

export async function createMerchantProductCollection(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  handle?: string | null | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
  title: string;
  visibility?: "public" | "hidden" | undefined;
}): Promise<MerchantProductCollectionMutationResult> {
  const response = await sendTaxonomyMutation({
    body: {
      title: options.title,
      handle: options.handle,
      ...(options.visibility ? { visibility: options.visibility } : {}),
    },
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    requestHost: options.requestHost,
    resource: "product-collections",
    tenantId: options.tenantId,
  });

  return parseProductCollectionMutationResponse(response);
}

export async function getMerchantProductCategories(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductCategoriesResult> {
  const response = await fetchProductResource({
    ...options,
    resource: "product-categories",
  });

  return parseProductCategoriesResponse(response);
}

export async function getMerchantProductCollections(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantProductCollectionsResult> {
  const response = await fetchProductResource({
    ...options,
    resource: "product-collections",
  });

  return parseProductCollectionsResponse(response);
}

export async function deleteMerchantProductCategory(options: {
  categoryId: string;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-categories`
    : "/platform/merchant/product-categories";
  const url = new URL(
    `${basePath}/${encodeURIComponent(options.categoryId)}`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );

  const response = await fetcher(url, {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "DELETE",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseDeleteResponse(response, "category");
}

export async function deleteMerchantProductCategoriesBatch(options: {
  categoryIds: string[];
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantBatchDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-categories`
    : "/platform/merchant/product-categories";
  const url = new URL(`${basePath}/batch-delete`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    body: JSON.stringify({ categoryIds: options.categoryIds }),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseBatchDeleteResponse(response);
}

export async function deleteMerchantProductCollection(options: {
  collectionId: string;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-collections`
    : "/platform/merchant/product-collections";
  const url = new URL(
    `${basePath}/${encodeURIComponent(options.collectionId)}`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );

  const response = await fetcher(url, {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "DELETE",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseDeleteResponse(response, "collection");
}

export async function deleteMerchantProductCollectionsBatch(options: {
  collectionIds: string[];
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
  tenantId?: string | null | undefined;
}): Promise<MerchantBatchDeleteActionResult> {
  const tenantId = options.tenantId?.trim();
  const fetcher = options.fetcher ?? fetch;
  const basePath = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/product-collections`
    : "/platform/merchant/product-collections";
  const url = new URL(`${basePath}/batch-delete`, normalizeBaseUrl(options.platformApiBaseUrl));

  const response = await fetcher(url, {
    body: JSON.stringify({ collectionIds: options.collectionIds }),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: tenantId ? undefined : options.requestHost,
    }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false,
      status: 503,
      message: "platform_request_failed",
    };
  }

  return parseBatchDeleteResponse(response);
}
