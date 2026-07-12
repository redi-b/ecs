import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProductCategoriesResult,
  MerchantProductCategoryWriteResult,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductDetailResult,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
} from "../../../types/index.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./medusa-http.js";
import {
  belongsToTenant,
  getTenantMetadata,
  normalizeProduct,
  normalizeProductCategory,
  normalizeProductCollection,
  normalizeProductStock,
} from "./normalize.js";
import {
  categoryBelongsToTenantById,
  collectionBelongsToTenantById,
  filterProductIdsBySalesChannel,
  productBelongsToSalesChannel,
  productExistsInSalesChannel,
  productIsInSalesChannel,
} from "./ownership.js";
import {
  getEmptyProductStock,
  getInventoryItemStock,
  getProductInventoryContext,
  getProductVariantInventoryContext,
  getStockWriteError,
  hydrateProductsWithStock,
  initializeProductStockLevels,
  writeInventoryItemStockLevel,
} from "./stock.js";
import type {
  ProductCategoryWriteInput,
  ProductCollectionWriteInput,
  ProductStockInput,
  ProductStockUpdateInput,
  ProductUpdateInput,
  ProductVariantStockInput,
  ProductVariantStockUpdateInput,
  ProductWriteInput,
} from "./types.js";
import {
  getInventoryItemLevelsUrl,
  getProductCategoriesBaseUrl,
  getProductCategoriesUrl,
  getProductCollectionsBaseUrl,
  getProductCollectionsUrl,
  getProductDetailUrl,
  getProductOwnershipUrl,
  getProductsBaseUrl,
  getProductsUrl,
  getProductUrl,
  normalizeBaseUrl,
} from "./urls.js";
import { getNumber, getString, isMissingCommerceResourceResponse } from "./values.js";
import {
  getDeleteError,
  getProductWriteBody,
  getWriteError,
  parseBatchDeleteResponse,
  parseDeleteResponse,
  parseProductCategoryWriteResponse,
  parseProductCollectionWriteResponse,
  parseProductWriteResponse,
} from "./write.js";

export function createMedusaProductService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  return {
    createMerchantProduct: async (
      input: ProductWriteInput,
    ): Promise<MerchantProductWriteResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(fetcher, getProductsBaseUrl(options.medusaInternalUrl), {
        body: JSON.stringify({
          ...getProductWriteBody(input),
          sales_channels: [{ id: input.salesChannelId }],
          ...(input.shippingProfileId?.trim()
            ? { shipping_profile_id: input.shippingProfileId.trim() }
            : {}),
        }),
        headers: getAdminHeaders(options.adminApiToken),
        method: "POST",
      });

      const result = await parseProductWriteResponse(response);

      if (!result.ok || !input.stockLocationId?.trim()) {
        return result;
      }

      const initialized = await initializeProductStockLevels(fetcher, options, {
        productId: result.product.id,
        salesChannelId: input.salesChannelId,
        stockLocationId: input.stockLocationId,
        variants: input.variants,
      });

      if (!initialized) {
        return result;
      }

      return result;
    },

    createMerchantProductCategory: async (
      input: ProductCategoryWriteInput,
    ): Promise<MerchantProductCategoryWriteResult> => {
      if (!options.adminApiToken?.trim()) {
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
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        },
      );

      return parseProductCategoryWriteResponse(response);
    },

    createMerchantProductCollection: async (
      input: ProductCollectionWriteInput,
    ): Promise<MerchantProductCollectionWriteResult> => {
      if (!options.adminApiToken?.trim()) {
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
          headers: getAdminHeaders(options.adminApiToken),
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
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing"
            | "category_not_found";
          status: 401 | 404 | 503;
        }
    > => {
      if (!options.adminApiToken?.trim()) return missingCredentials();
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
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        });
        if (!response?.ok) {
          if (response?.status === 404) {
            return { error: "category_not_found", ok: false, status: 404 };
          }
          return response?.status === 401
            ? { error: "commerce_credentials_invalid", ok: false, status: 401 }
            : { error: "commerce_backend_unavailable", ok: false, status: 503 };
        }
      }
      return { ok: true };
    },

    updateMerchantProductCategory: async (
      input: ProductCategoryWriteInput & { categoryId: string },
    ): Promise<MerchantProductCategoryWriteResult> => {
      if (!options.adminApiToken?.trim()) return missingCredentials();
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
        headers: getAdminHeaders(options.adminApiToken),
        method: "POST",
      });
      return parseProductCategoryWriteResponse(response);
    },

    updateMerchantProductCollection: async (
      input: ProductCollectionWriteInput & { collectionId: string },
    ): Promise<MerchantProductCollectionWriteResult> => {
      if (!options.adminApiToken?.trim()) return missingCredentials();
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
        headers: getAdminHeaders(options.adminApiToken),
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
      if (!options.adminApiToken?.trim()) return missingCredentials();
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
        headers: getAdminHeaders(options.adminApiToken),
      });
      if (response.status === 401) {
        return { ok: false, error: "commerce_credentials_invalid", status: 401 };
      }
      if (!response.ok) {
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      }
      const data = await response.json().catch(() => undefined);
      const products = Array.isArray(data?.products)
        ? data.products.flatMap(normalizeProduct)
        : [];
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
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing"
            | "collection_not_found";
          status: 401 | 404 | 503;
        }
    > => {
      if (!options.adminApiToken?.trim()) return missingCredentials();
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

      // Ensure products are on this merchant sales channel before linking.
      for (const productId of [...add, ...remove]) {
        const inChannel = await productExistsInSalesChannel(fetcher, options, {
          productId,
          salesChannelId: input.salesChannelId,
        });
        if (!inChannel) {
          return { error: "commerce_backend_unavailable", ok: false, status: 503 };
        }
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
        headers: getAdminHeaders(options.adminApiToken),
        method: "POST",
      });
      if (response.status === 401) {
        return { ok: false, error: "commerce_credentials_invalid", status: 401 };
      }
      if (response.status === 404) {
        return { ok: false, error: "collection_not_found", status: 404 };
      }
      if (!response.ok) {
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      }
      return { ok: true };
    },

    listMerchantProducts: async (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
      stockLocationId?: string | null | undefined;
    }): Promise<MerchantProductsResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      let response: Response;

      try {
        response = await fetcher(getProductsUrl(options.medusaInternalUrl, input), {
          headers: getAdminHeaders(options.adminApiToken),
        });
      } catch {
        return {
          ok: false,
          error: "commerce_backend_unavailable",
          status: 503,
        };
      }

      if (response.status === 401) {
        return {
          ok: false,
          error: "commerce_credentials_invalid",
          status: 401,
        };
      }

      if (response.status === 404 && (await isMissingCommerceResourceResponse(response))) {
        return {
          ok: false,
          error: "commerce_resource_missing",
          status: 503,
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

      const normalizedProducts = Array.isArray(data?.products)
        ? data.products.flatMap(normalizeProduct)
        : [];
      const products = input.stockLocationId?.trim()
        ? await hydrateProductsWithStock(fetcher, options, {
            products: normalizedProducts,
            stockLocationId: input.stockLocationId,
          })
        : normalizedProducts;

      return {
        ok: true,
        count: getNumber(data?.count) ?? 0,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
        products,
      };
    },

    getMerchantProduct: async (input: {
      productId: string;
      salesChannelId: string;
    }): Promise<MerchantProductDetailResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getProductDetailUrl(options.medusaInternalUrl, input.productId),
        {
          headers: getAdminHeaders(options.adminApiToken),
        },
      );

      if (!response.ok) {
        return getWriteError(response);
      }

      const data = await response.json().catch(() => undefined);

      if (
        !(await productIsInSalesChannel(fetcher, options, {
          product: data?.product,
          productId: input.productId,
          salesChannelId: input.salesChannelId,
        }))
      ) {
        return {
          ok: false,
          error: "product_not_found",
          status: 404,
        };
      }

      const product = normalizeProduct(data?.product)[0];

      if (!product) {
        return {
          ok: false,
          error: "product_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        product,
      };
    },

    listMerchantProductCategories: async (input: {
      limit: number;
      offset: number;
      tenantId: string;
    }): Promise<MerchantProductCategoriesResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getProductCategoriesUrl(options.medusaInternalUrl, input),
        {
          headers: getAdminHeaders(options.adminApiToken),
        },
      );

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
      const categories = Array.isArray(data?.product_categories)
        ? data.product_categories
            .filter((category: unknown) => belongsToTenant(category, input.tenantId))
            .flatMap(normalizeProductCategory)
        : [];

      return {
        ok: true,
        categories,
        count: categories.length,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
      };
    },

    listMerchantProductCollections: async (input: {
      limit: number;
      offset: number;
      tenantId: string;
    }): Promise<MerchantProductCollectionsResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getProductCollectionsUrl(options.medusaInternalUrl, input),
        {
          headers: getAdminHeaders(options.adminApiToken),
        },
      );

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
      const collections = Array.isArray(data?.collections)
        ? data.collections
            .filter((collection: unknown) => belongsToTenant(collection, input.tenantId))
            .flatMap(normalizeProductCollection)
        : [];

      return {
        ok: true,
        collections,
        count: collections.length,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
      };
    },

    getMerchantProductStock: async (
      input: ProductStockInput,
    ): Promise<MerchantProductStockResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const inventory = await getProductInventoryContext(fetcher, options, input);

      if (!inventory.ok) {
        return inventory;
      }

      return getInventoryItemStock(fetcher, options, {
        inventoryItemId: inventory.inventoryItemId,
        productId: input.productId,
        stockLocationId: input.stockLocationId,
        variantId: inventory.variantId,
      });
    },

    getMerchantProductVariantStock: async (
      input: ProductVariantStockInput,
    ): Promise<MerchantProductStockResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const inventory = await getProductVariantInventoryContext(fetcher, options, input);

      if (!inventory.ok) {
        return inventory;
      }

      return getInventoryItemStock(fetcher, options, {
        inventoryItemId: inventory.inventoryItemId,
        productId: input.productId,
        stockLocationId: input.stockLocationId,
        variantId: inventory.variantId,
      });
    },

    updateMerchantProductStock: async (
      input: ProductStockUpdateInput,
    ): Promise<MerchantProductStockUpdateResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const inventory = await getProductInventoryContext(fetcher, options, input);

      if (!inventory.ok) {
        return inventory;
      }

      const response = await writeInventoryItemStockLevel(fetcher, options, {
        inventoryItemId: inventory.inventoryItemId,
        stockLocationId: input.stockLocationId,
        stockedQuantity: input.stockedQuantity,
      });

      if (!response.ok) {
        return getStockWriteError(response);
      }

      const data = await response.json().catch(() => undefined);
      const stock = normalizeProductStock({
        inventoryItemId: inventory.inventoryItemId,
        productId: input.productId,
        stockLocationId: input.stockLocationId,
        variantId: inventory.variantId,
        value: data?.inventory_item,
      });

      return {
        ok: true,
        stock: stock ?? {
          productId: input.productId,
          variantId: inventory.variantId,
          inventoryItemId: inventory.inventoryItemId,
          locationId: input.stockLocationId,
          stockedQuantity: input.stockedQuantity,
          reservedQuantity: null,
          incomingQuantity: null,
          availableQuantity: null,
        },
      };
    },

    updateMerchantProductVariantStock: async (
      input: ProductVariantStockUpdateInput,
    ): Promise<MerchantProductStockUpdateResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const inventory = await getProductVariantInventoryContext(fetcher, options, input);

      if (!inventory.ok) {
        return inventory;
      }

      const response = await writeInventoryItemStockLevel(fetcher, options, {
        inventoryItemId: inventory.inventoryItemId,
        stockLocationId: input.stockLocationId,
        stockedQuantity: input.stockedQuantity,
      });

      if (!response.ok) {
        return getStockWriteError(response);
      }

      const data = await response.json().catch(() => undefined);
      const stock = normalizeProductStock({
        inventoryItemId: inventory.inventoryItemId,
        productId: input.productId,
        stockLocationId: input.stockLocationId,
        variantId: inventory.variantId,
        value: data?.inventory_item,
      });

      return {
        ok: true,
        stock: stock ?? {
          productId: input.productId,
          variantId: inventory.variantId,
          inventoryItemId: inventory.inventoryItemId,
          locationId: input.stockLocationId,
          stockedQuantity: input.stockedQuantity,
          reservedQuantity: null,
          incomingQuantity: null,
          availableQuantity: null,
        },
      };
    },

    updateMerchantProduct: async (
      input: ProductUpdateInput,
    ): Promise<MerchantProductWriteResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const retrieveResponse = await requestMedusa(
        fetcher,
        getProductOwnershipUrl(options.medusaInternalUrl, input.productId),
        {
          headers: getAdminHeaders(options.adminApiToken),
        },
      );

      if (!retrieveResponse.ok) {
        return getWriteError(retrieveResponse);
      }

      const retrieveData = await retrieveResponse.json().catch(() => undefined);

      if (
        !(await productIsInSalesChannel(fetcher, options, {
          product: retrieveData?.product,
          productId: input.productId,
          salesChannelId: input.salesChannelId,
        }))
      ) {
        return {
          ok: false,
          error: "product_not_found",
          status: 404,
        };
      }

      const updateResponse = await requestMedusa(
        fetcher,
        getProductUrl(options.medusaInternalUrl, input.productId),
        {
          body: JSON.stringify(getProductWriteBody(input)),
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        },
      );

      return parseProductWriteResponse(updateResponse);
    },

    deleteMerchantProduct: async (input: {
      productId: string;
      salesChannelId: string;
    }): Promise<MerchantDeleteResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const retrieveResponse = await requestMedusa(
        fetcher,
        getProductOwnershipUrl(options.medusaInternalUrl, input.productId),
        {
          headers: getAdminHeaders(options.adminApiToken!),
        },
      );

      if (!retrieveResponse.ok) {
        return getDeleteError(retrieveResponse, "product");
      }

      const retrieveData = await retrieveResponse.json().catch(() => undefined);

      if (
        !(await productIsInSalesChannel(fetcher, options, {
          product: retrieveData?.product,
          productId: input.productId,
          salesChannelId: input.salesChannelId,
        }))
      ) {
        return {
          ok: false,
          error: "product_not_found",
          status: 404,
        };
      }

      const response = await requestMedusa(
        fetcher,
        new URL(
          `/admin/products/${encodeURIComponent(input.productId)}`,
          normalizeBaseUrl(options.medusaInternalUrl),
        ),
        {
          headers: getAdminHeaders(options.adminApiToken!),
          method: "DELETE",
        },
      );

      return parseDeleteResponse(response, "product");
    },

    deleteMerchantProductsBatch: async (input: {
      productIds: string[];
      salesChannelId: string;
    }): Promise<MerchantBatchDeleteResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const verifiedIds = await filterProductIdsBySalesChannel(
        fetcher,
        options,
        input.productIds,
        input.salesChannelId,
      );

      if (!Array.isArray(verifiedIds)) {
        return verifiedIds;
      }

      if (verifiedIds.length === 0) {
        return {
          ok: true,
          ids: [],
          deleted: true,
        };
      }

      const response = await requestMedusa(
        fetcher,
        new URL(`/admin/products/batch`, normalizeBaseUrl(options.medusaInternalUrl)),
        {
          body: JSON.stringify({ delete: verifiedIds }),
          headers: getAdminHeaders(options.adminApiToken!),
          method: "POST",
        },
      );

      return parseBatchDeleteResponse(response, verifiedIds);
    },

    deleteMerchantProductCategory: async (input: {
      categoryId: string;
      tenantId: string;
    }): Promise<MerchantDeleteResult> => {
      if (!options.adminApiToken?.trim()) {
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
          headers: getAdminHeaders(options.adminApiToken!),
          method: "DELETE",
        },
      );

      return parseDeleteResponse(response, "category");
    },

    deleteMerchantProductCategoriesBatch: async (input: {
      categoryIds: string[];
      tenantId: string;
    }): Promise<MerchantBatchDeleteResult> => {
      if (!options.adminApiToken?.trim()) {
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
              headers: getAdminHeaders(options.adminApiToken!),
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
      if (!options.adminApiToken?.trim()) {
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
          headers: getAdminHeaders(options.adminApiToken!),
          method: "DELETE",
        },
      );

      return parseDeleteResponse(response, "collection");
    },

    deleteMerchantProductCollectionsBatch: async (input: {
      collectionIds: string[];
      tenantId: string;
    }): Promise<MerchantBatchDeleteResult> => {
      if (!options.adminApiToken?.trim()) {
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
              headers: getAdminHeaders(options.adminApiToken!),
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
