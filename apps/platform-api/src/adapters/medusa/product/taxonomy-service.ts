import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProductCategoriesResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductsResult,
} from "../../../types/index.js";
import { mapMedusaHttpFailure } from "../map-medusa-failure.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./medusa-http.js";
import {
  belongsToTenant,
  getTenantMetadata,
  normalizeProduct,
  normalizeProductCategory,
  normalizeProductCollection,
} from "./normalize.js";
import {
  categoryBelongsToTenantById,
  collectionBelongsToTenantById,
  filterProductIdsBySalesChannel,
} from "./ownership.js";
import type { ProductCategoryWriteInput, ProductCollectionWriteInput } from "./types.js";
import {
  getProductCategoriesBaseUrl,
  getProductCollectionsBaseUrl,
  getProductsUrl,
  getTenantTaxonomyUrl,
  normalizeBaseUrl,
} from "./urls.js";
import { getNumber } from "./values.js";
import {
  parseDeleteResponse,
  parseProductCategoryWriteResponse,
  parseProductCollectionWriteResponse,
} from "./write.js";

export function createMedusaProductTaxonomyService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;
  const adminApiToken = options.adminApiToken?.trim();

  return {
    createMerchantProductCategory: async (
      input: ProductCategoryWriteInput,
    ): Promise<MerchantProductCategoryWriteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getProductCategoriesBaseUrl(options.medusaInternalUrl),
        {
          body: JSON.stringify({
            name: input.name,
            ...(input.handle?.trim() ? { handle: input.handle } : {}),
            is_active: input.visibility !== "hidden",
            is_internal: false,
            ...(input.parentCategoryId ? { parent_category_id: input.parentCategoryId } : {}),
            ...(typeof input.rank === "number" ? { rank: input.rank } : {}),
            metadata: getTaxonomyMetadata(input),
          }),
          headers: getAdminHeaders(adminApiToken),
          method: "POST",
        },
      );

      return parseProductCategoryWriteResponse(response);
    },

    createMerchantProductCollection: async (
      input: ProductCollectionWriteInput,
    ): Promise<MerchantProductCollectionWriteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getProductCollectionsBaseUrl(options.medusaInternalUrl),
        {
          body: JSON.stringify({
            title: input.title,
            ...(input.handle?.trim() ? { handle: input.handle } : {}),
            metadata: getTaxonomyMetadata(input),
          }),
          headers: getAdminHeaders(adminApiToken),
          method: "POST",
        },
      );

      return parseProductCollectionWriteResponse(response);
    },

    reorderMerchantProductCategories: async (input: {
      items: Array<{ categoryId: string; rank: number }>;
      tenantId: string;
    }): Promise<
      | { ok: true }
      | {
          ok: false;
          error:
            | "commerce_backend_unavailable"
            | "commerce_backend_error"
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing"
            | "category_not_found"
            | "category_write_invalid";
          status: 400 | 401 | 404 | 502 | 503;
        }
    > => {
      if (!adminApiToken) return missingCredentials();
      for (const item of input.items) {
        const owned = await categoryBelongsToTenantById(
          fetcher,
          options,
          item.categoryId,
          input.tenantId,
        );
        if (owned !== true) {
          return typeof owned === "object"
            ? owned
            : { error: "commerce_backend_unavailable", ok: false, status: 503 };
        }
        const url = new URL(
          `/admin/product-categories/${encodeURIComponent(item.categoryId)}`,
          normalizeBaseUrl(options.medusaInternalUrl),
        );
        const response = await requestMedusa(fetcher, url, {
          body: JSON.stringify({ rank: item.rank }),
          headers: getAdminHeaders(adminApiToken),
          method: "POST",
        });
        if (!response?.ok) {
          return mapMedusaHttpFailure(response, {
            invalidError: "category_write_invalid",
            notFoundError: "category_not_found",
          }) as {
            ok: false;
            error:
              | "commerce_backend_unavailable"
              | "commerce_credentials_invalid"
              | "category_not_found"
              | "category_write_invalid";
            status: 400 | 401 | 404 | 503;
          };
        }
      }
      return { ok: true };
    },

    updateMerchantProductCategory: async (
      input: ProductCategoryWriteInput & { categoryId: string },
    ): Promise<MerchantProductCategoryWriteResult> => {
      if (!adminApiToken) return missingCredentials();
      const owned = await categoryBelongsToTenantById(
        fetcher,
        options,
        input.categoryId,
        input.tenantId,
      );
      if (owned !== true)
        return typeof owned === "object"
          ? owned
          : { error: "commerce_backend_unavailable", ok: false, status: 503 };
      const url = new URL(
        `/admin/product-categories/${encodeURIComponent(input.categoryId)}`,
        normalizeBaseUrl(options.medusaInternalUrl),
      );
      const response = await requestMedusa(fetcher, url, {
        body: JSON.stringify({
          handle: input.handle || undefined,
          is_active: input.visibility !== "hidden",
          metadata: getTaxonomyMetadata(input),
          name: input.name,
          parent_category_id: input.parentCategoryId || null,
          ...(typeof input.rank === "number" ? { rank: input.rank } : {}),
        }),
        headers: getAdminHeaders(adminApiToken),
        method: "POST",
      });
      return parseProductCategoryWriteResponse(response);
    },

    updateMerchantProductCollection: async (
      input: ProductCollectionWriteInput & { collectionId: string },
    ): Promise<MerchantProductCollectionWriteResult> => {
      if (!adminApiToken) return missingCredentials();
      const owned = await collectionBelongsToTenantById(
        fetcher,
        options,
        input.collectionId,
        input.tenantId,
      );
      if (owned !== true)
        return typeof owned === "object"
          ? owned
          : { error: "commerce_backend_unavailable", ok: false, status: 503 };
      const url = new URL(
        `/admin/collections/${encodeURIComponent(input.collectionId)}`,
        normalizeBaseUrl(options.medusaInternalUrl),
      );
      const response = await requestMedusa(fetcher, url, {
        body: JSON.stringify({
          handle: input.handle || undefined,
          metadata: getTaxonomyMetadata(input),
          title: input.title,
        }),
        headers: getAdminHeaders(adminApiToken),
        method: "POST",
      });
      return parseProductCollectionWriteResponse(response);
    },

    listMerchantCollectionProducts: async (input: {
      collectionId: string;
      limit: number;
      offset: number;
      salesChannelId: string;
      tenantId: string;
    }): Promise<MerchantProductsResult> => {
      if (!adminApiToken) return missingCredentials();
      const owned = await collectionBelongsToTenantById(
        fetcher,
        options,
        input.collectionId,
        input.tenantId,
      );
      if (owned !== true)
        return typeof owned === "object"
          ? owned
          : { error: "commerce_backend_unavailable", ok: false, status: 503 };

      const url = getProductsUrl(options.medusaInternalUrl, {
        limit: input.limit,
        offset: input.offset,
        salesChannelId: input.salesChannelId,
      });
      url.searchParams.set("collection_id[]", input.collectionId);

      const response = await requestMedusa(fetcher, url, {
        headers: getAdminHeaders(adminApiToken),
      });
      if (response.status === 401) {
        return { ok: false, error: "commerce_credentials_invalid", status: 401 };
      }
      if (!response.ok)
        return mapMedusaHttpFailure(response) as Extract<
          MerchantProductCategoriesResult,
          { ok: false }
        >;
      const data = await response.json().catch(() => undefined);
      const products = Array.isArray(data?.products) ? data.products.flatMap(normalizeProduct) : [];
      return {
        ok: true,
        count: getNumber(data?.count) ?? products.length,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
        products,
      };
    },

    updateMerchantCollectionProducts: async (input: {
      add?: string[] | undefined;
      collectionId: string;
      remove?: string[] | undefined;
      salesChannelId: string;
      tenantId: string;
    }): Promise<
      | { ok: true }
      | {
          ok: false;
          error:
            | "commerce_backend_unavailable"
            | "commerce_backend_error"
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing"
            | "collection_not_found"
            | "collection_write_invalid"
            | "product_not_found";
          status: 400 | 401 | 404 | 502 | 503;
        }
    > => {
      if (!adminApiToken) return missingCredentials();
      const owned = await collectionBelongsToTenantById(
        fetcher,
        options,
        input.collectionId,
        input.tenantId,
      );
      if (owned !== true)
        return typeof owned === "object"
          ? owned
          : { error: "commerce_backend_unavailable", ok: false, status: 503 };

      const add = (input.add ?? []).filter(Boolean);
      const remove = (input.remove ?? []).filter(Boolean);
      if (!add.length && !remove.length) return { ok: true };

      // Verify the whole selection in one request instead of one ownership read per product.
      const productIds = [...new Set([...add, ...remove])];
      const ownedProductIds = await filterProductIdsBySalesChannel(
        fetcher,
        options,
        productIds,
        input.salesChannelId,
      );
      if (!Array.isArray(ownedProductIds)) {
        return ownedProductIds;
      }
      if (ownedProductIds.length !== productIds.length) {
        return { error: "product_not_found", ok: false, status: 404 };
      }

      const url = new URL(
        `/admin/collections/${encodeURIComponent(input.collectionId)}/products`,
        normalizeBaseUrl(options.medusaInternalUrl),
      );
      const response = await requestMedusa(fetcher, url, {
        body: JSON.stringify({
          ...(add.length ? { add } : {}),
          ...(remove.length ? { remove } : {}),
        }),
        headers: getAdminHeaders(adminApiToken),
        method: "POST",
      });
      if (!response.ok) {
        return mapMedusaHttpFailure(response, {
          invalidError: "collection_write_invalid",
          notFoundError: "collection_not_found",
        }) as {
          ok: false;
          error:
            | "commerce_backend_unavailable"
            | "commerce_credentials_invalid"
            | "collection_not_found"
            | "collection_write_invalid";
          status: 400 | 401 | 404 | 503;
        };
      }
      return { ok: true };
    },

    listMerchantProductCategories: async (input: {
      visibility?: string | undefined;
      parentId?: string | undefined;
      limit: number;
      offset: number;
      q?: string | undefined;
      tenantId: string;
    }): Promise<MerchantProductCategoriesResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getTenantTaxonomyUrl(options.medusaInternalUrl, "categories", input),
        {
          headers: getAdminHeaders(adminApiToken),
        },
      );

      if (response.status === 401) {
        return {
          ok: false,
          error: "commerce_credentials_invalid",
          status: 401,
        };
      }

      if (!response.ok)
        return mapMedusaHttpFailure(response) as Extract<
          MerchantProductCollectionsResult,
          { ok: false }
        >;

      const data = await response.json().catch(() => undefined);
      const categories = Array.isArray(data?.product_categories)
        ? data.product_categories
            .filter((category: unknown) => belongsToTenant(category, input.tenantId))
            .flatMap(normalizeProductCategory)
        : [];

      if (
        !Array.isArray(data?.product_categories) ||
        data.product_categories.length !== categories.length
      ) {
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      }

      return {
        ok: true,
        categories,
        count: getNumber(data?.count) ?? categories.length,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
      };
    },

    listMerchantProductCollections: async (input: {
      visibility?: string | undefined;
      limit: number;
      offset: number;
      q?: string | undefined;
      tenantId: string;
    }): Promise<MerchantProductCollectionsResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getTenantTaxonomyUrl(options.medusaInternalUrl, "collections", input),
        {
          headers: getAdminHeaders(adminApiToken),
        },
      );

      if (response.status === 401) {
        return {
          ok: false,
          error: "commerce_credentials_invalid",
          status: 401,
        };
      }

      if (!response.ok)
        return mapMedusaHttpFailure(response) as Extract<
          MerchantProductCategoriesResult,
          { ok: false }
        >;

      const data = await response.json().catch(() => undefined);
      const collections = Array.isArray(data?.collections)
        ? data.collections
            .filter((collection: unknown) => belongsToTenant(collection, input.tenantId))
            .flatMap(normalizeProductCollection)
        : [];

      if (!Array.isArray(data?.collections) || data.collections.length !== collections.length) {
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      }

      return {
        ok: true,
        collections,
        count: getNumber(data?.count) ?? collections.length,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
      };
    },

    deleteMerchantProductCategory: async (input: {
      categoryId: string;
      tenantId: string;
    }): Promise<MerchantDeleteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const ownership = await categoryBelongsToTenantById(
        fetcher,
        options,
        input.categoryId,
        input.tenantId,
      );
      if (typeof ownership === "object") {
        return ownership;
      }
      if (!ownership) {
        return {
          ok: false,
          error: "category_not_found",
          status: 404,
        };
      }

      const response = await requestMedusa(
        fetcher,
        new URL(
          `/admin/product-categories/${encodeURIComponent(input.categoryId)}`,
          normalizeBaseUrl(options.medusaInternalUrl),
        ),
        {
          headers: getAdminHeaders(adminApiToken),
          method: "DELETE",
        },
      );

      return parseDeleteResponse(response, "category");
    },

    deleteMerchantProductCategoriesBatch: async (input: {
      categoryIds: string[];
      tenantId: string;
    }): Promise<MerchantBatchDeleteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const results = await Promise.all(
        input.categoryIds.map((id) =>
          categoryBelongsToTenantById(fetcher, options, id, input.tenantId),
        ),
      );

      for (const r of results) {
        if (typeof r === "object") {
          return r;
        }
      }

      const verifiedIds = input.categoryIds.filter((_, idx) => {
        const r = results[idx];
        return typeof r === "boolean" && r === true;
      });

      if (verifiedIds.length === 0) {
        return {
          ok: true,
          ids: [],
          deleted: true,
        };
      }

      const deleteResults = await Promise.all(
        verifiedIds.map(async (id) => {
          const response = await requestMedusa(
            fetcher,
            new URL(
              `/admin/product-categories/${encodeURIComponent(id)}`,
              normalizeBaseUrl(options.medusaInternalUrl),
            ),
            {
              headers: getAdminHeaders(adminApiToken),
              method: "DELETE",
            },
          );
          return parseDeleteResponse(response, "category");
        }),
      );

      for (const r of deleteResults) {
        if (!r.ok) {
          if (r.error === "commerce_credentials_invalid") {
            return {
              ok: false,
              error: "commerce_credentials_invalid",
              status: 401,
            };
          }
          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        }
      }

      const successfulIds = deleteResults
        .filter((r): r is Extract<MerchantDeleteResult, { ok: true }> => r.ok)
        .map((r) => r.id);

      return {
        ok: true,
        ids: successfulIds,
        deleted: true,
      };
    },

    deleteMerchantProductCollection: async (input: {
      collectionId: string;
      tenantId: string;
    }): Promise<MerchantDeleteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const ownership = await collectionBelongsToTenantById(
        fetcher,
        options,
        input.collectionId,
        input.tenantId,
      );
      if (typeof ownership === "object") {
        return ownership;
      }
      if (!ownership) {
        return {
          ok: false,
          error: "collection_not_found",
          status: 404,
        };
      }

      const response = await requestMedusa(
        fetcher,
        new URL(
          `/admin/collections/${encodeURIComponent(input.collectionId)}`,
          normalizeBaseUrl(options.medusaInternalUrl),
        ),
        {
          headers: getAdminHeaders(adminApiToken),
          method: "DELETE",
        },
      );

      return parseDeleteResponse(response, "collection");
    },

    deleteMerchantProductCollectionsBatch: async (input: {
      collectionIds: string[];
      tenantId: string;
    }): Promise<MerchantBatchDeleteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const results = await Promise.all(
        input.collectionIds.map((id) =>
          collectionBelongsToTenantById(fetcher, options, id, input.tenantId),
        ),
      );

      for (const r of results) {
        if (typeof r === "object") {
          return r;
        }
      }

      const verifiedIds = input.collectionIds.filter((_, idx) => {
        const r = results[idx];
        return typeof r === "boolean" && r === true;
      });

      if (verifiedIds.length === 0) {
        return {
          ok: true,
          ids: [],
          deleted: true,
        };
      }

      const deleteResults = await Promise.all(
        verifiedIds.map(async (id) => {
          const response = await requestMedusa(
            fetcher,
            new URL(
              `/admin/collections/${encodeURIComponent(id)}`,
              normalizeBaseUrl(options.medusaInternalUrl),
            ),
            {
              headers: getAdminHeaders(adminApiToken),
              method: "DELETE",
            },
          );
          return parseDeleteResponse(response, "collection");
        }),
      );

      for (const r of deleteResults) {
        if (!r.ok) {
          if (r.error === "commerce_credentials_invalid") {
            return {
              ok: false,
              error: "commerce_credentials_invalid",
              status: 401,
            };
          }
          return {
            ok: false,
            error: "commerce_backend_unavailable",
            status: 503,
          };
        }
      }

      const successfulIds = deleteResults
        .filter((r): r is Extract<MerchantDeleteResult, { ok: true }> => r.ok)
        .map((r) => r.id);

      return {
        ok: true,
        ids: successfulIds,
        deleted: true,
      };
    },
  };
}

function getTaxonomyMetadata(input: ProductCategoryWriteInput | ProductCollectionWriteInput) {
  return {
    ...getTenantMetadata(input.tenantId),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    ...(input.seoTitle?.trim() ? { seo_title: input.seoTitle.trim() } : {}),
    ...(input.seoDescription?.trim() ? { seo_description: input.seoDescription.trim() } : {}),
    ...(input.mediaUrl?.trim() ? { media_url: input.mediaUrl.trim() } : {}),
  };
}
