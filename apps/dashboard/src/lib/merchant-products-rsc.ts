import { cache } from "react";

import {
  getMerchantProduct,
  getMerchantProductCategories,
  getMerchantProductCollections,
  getMerchantProductStock,
  getMerchantProducts,
} from "@/lib/merchant-products";

/**
 * Request-level memo for RSC product data loaders.
 * React `cache` keys on arguments — use primitives so parallel page segments
 * share one platform fetch when the same tenant/page requests taxonomy twice.
 */

export const getMerchantProductsCached = cache(
  async (
    platformApiBaseUrl: string,
    cookieHeader: string | null,
    requestHost: string | null,
    tenantId: string | null | undefined,
    limit: number,
    offset: number,
    q: string | undefined,
    status: string | undefined,
    collectionId: string | undefined,
    categoryId: string | undefined,
  ) =>
    getMerchantProducts({
      cookieHeader,
      limit,
      offset,
      platformApiBaseUrl,
      requestHost,
      tenantId,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(collectionId ? { collectionId } : {}),
      ...(categoryId ? { categoryId } : {}),
    }),
);

export const getMerchantProductCached = cache(
  async (
    platformApiBaseUrl: string,
    cookieHeader: string | null,
    requestHost: string | null,
    tenantId: string | null | undefined,
    productId: string,
  ) =>
    getMerchantProduct({
      cookieHeader,
      platformApiBaseUrl,
      productId,
      requestHost,
      tenantId,
    }),
);

export const getMerchantProductStockCached = cache(
  async (
    platformApiBaseUrl: string,
    cookieHeader: string | null,
    requestHost: string | null,
    tenantId: string | null | undefined,
    productId: string,
  ) =>
    getMerchantProductStock({
      cookieHeader,
      platformApiBaseUrl,
      productId,
      requestHost,
      tenantId,
    }),
);

export const getMerchantProductCategoriesCached = cache(
  async (
    platformApiBaseUrl: string,
    cookieHeader: string | null,
    requestHost: string | null,
    tenantId: string | null | undefined,
    limit: number,
    offset: number,
  ) =>
    getMerchantProductCategories({
      cookieHeader,
      limit,
      offset,
      platformApiBaseUrl,
      requestHost,
      tenantId,
    }),
);

export const getMerchantProductCollectionsCached = cache(
  async (
    platformApiBaseUrl: string,
    cookieHeader: string | null,
    requestHost: string | null,
    tenantId: string | null | undefined,
    limit: number,
    offset: number,
  ) =>
    getMerchantProductCollections({
      cookieHeader,
      limit,
      offset,
      platformApiBaseUrl,
      requestHost,
      tenantId,
    }),
);
