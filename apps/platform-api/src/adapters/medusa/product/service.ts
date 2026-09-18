import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProduct,
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
import { mapMedusaHttpFailure } from "../map-medusa-failure.js";
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
  productIsInSalesChannel,
} from "./ownership.js";
import {
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
  getPlatformProductUpdateUrl,
  getProductCategoriesBaseUrl,
  getProductCollectionsBaseUrl,
  getProductDetailUrl,
  getProductOwnershipUrl,
  getProductSearchUrl,
  getProductsBaseUrl,
  getProductsUrl,
  getTenantTaxonomyUrl,
  normalizeBaseUrl,
} from "./urls.js";
import { getNumber, getString, isMissingCommerceResourceResponse, isRecord } from "./values.js";
import {
  completeVariantOptionsForCurrentProduct,
  getDeleteError,
  getProductOptionBatchBody,
  getProductWriteBody,
  getWriteError,
  parseBatchDeleteResponse,
  parseDeleteResponse,
  parseProductCategoryWriteResponse,
  parseProductCollectionWriteResponse,
  parseProductWriteResponse,
  splitProductOptionBatchBody,
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
            | "commerce_backend_error"
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing"
            | "category_not_found"
            | "category_write_invalid";
          status: 400 | 401 | 404 | 502 | 503;
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
        headers: getAdminHeaders(options.adminApiToken),
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

    listMerchantProducts: async (input: {
      media?: "with_media" | "without_media" | undefined;
      categoryId?: string | undefined;
      collectionId?: string | undefined;
      limit: number;
      offset: number;
      q?: string | undefined;
      salesChannelId: string;
      status?: string | undefined;
      stockLocationId?: string | null | undefined;
    }): Promise<MerchantProductsResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      if (input.q?.trim() && !input.media) {
        const indexed = await requestMedusa(
          fetcher,
          getProductSearchUrl(options.medusaInternalUrl, {
            limit: input.limit,
            offset: input.offset,
            q: input.q.trim(),
            salesChannelId: input.salesChannelId,
            ...(input.categoryId?.trim() && !["all", "none"].includes(input.categoryId)
              ? { categoryId: input.categoryId.trim() }
              : {}),
            ...(input.collectionId?.trim() && !["all", "none"].includes(input.collectionId)
              ? { collectionId: input.collectionId.trim() }
              : {}),
            ...(input.status?.trim() && input.status !== "all"
              ? { status: input.status.trim() }
              : {}),
          }),
          { headers: getAdminHeaders(options.adminApiToken) },
        ).catch(() => undefined);
        if (indexed?.ok) {
          const searchData = await indexed.json().catch(() => undefined);
          const ids: Array<string | null> | null = Array.isArray(searchData?.hits)
            ? searchData.hits.map((hit: unknown) => (isRecord(hit) ? getString(hit.id) : null))
            : null;
          if (
            ids &&
            ids.every((id: string | null): id is string => Boolean(id)) &&
            Number.isSafeInteger(searchData?.count) &&
            searchData?.index_document_count !== 0
          ) {
            if (!ids.length) {
              return {
                ok: true,
                count: searchData.count,
                limit: input.limit,
                offset: input.offset,
                products: [],
              };
            }
            const { q: _query, ...hydrateInput } = input;
            const url = getProductsUrl(options.medusaInternalUrl, {
              ...hydrateInput,
              limit: ids.length,
              offset: 0,
            });
            ids.forEach((id: string) => {
              url.searchParams.append("id[]", id);
            });
            const hydration = await requestMedusa(fetcher, url, {
              headers: getAdminHeaders(options.adminApiToken),
            }).catch(() => undefined);
            if (hydration?.ok) {
              const hydrationData = await hydration.json().catch(() => undefined);
              if (Array.isArray(hydrationData?.products)) {
                const normalized: MerchantProduct[] = hydrationData.products.flatMap(
                  (product: unknown) => normalizeProduct(product),
                );
                const byId = new Map(normalized.map((product) => [product.id, product]));
                const ranked = ids.flatMap((id: string) => {
                  const product = byId.get(id);
                  return product ? [product] : [];
                });
                const products = input.stockLocationId?.trim()
                  ? await hydrateProductsWithStock(fetcher, options, {
                      products: ranked,
                      stockLocationId: input.stockLocationId,
                    })
                  : ranked;
                return {
                  ok: true,
                  count: searchData.count,
                  limit: input.limit,
                  offset: input.offset,
                  products,
                };
              }
            }
          }
        }
      }

      const response = await requestMedusa(
        fetcher,
        getProductsUrl(options.medusaInternalUrl, input),
        { headers: getAdminHeaders(options.adminApiToken) },
      );
      if (response.status === 401)
        return { ok: false, error: "commerce_credentials_invalid", status: 401 };
      if (response.status === 404 && (await isMissingCommerceResourceResponse(response)))
        return { ok: false, error: "commerce_resource_missing", status: 503 };
      if (response.status === 404)
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      if (response.status >= 500)
        return mapMedusaHttpFailure(response) as Extract<MerchantProductsResult, { ok: false }>;
      if (!response.ok)
        return mapMedusaHttpFailure(response) as Extract<MerchantProductsResult, { ok: false }>;
      const data = await response.json().catch(() => undefined);
      if (!Array.isArray(data?.products) || !Number.isSafeInteger(data.count) || data.count < 0)
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      const normalizedProducts = data.products.flatMap(normalizeProduct);
      if (normalizedProducts.length !== data.products.length)
        return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      const products = input.stockLocationId?.trim()
        ? await hydrateProductsWithStock(fetcher, options, {
            products: normalizedProducts,
            stockLocationId: input.stockLocationId,
          })
        : normalizedProducts;
      return { ok: true, count: data.count, limit: input.limit, offset: input.offset, products };
    },

    getMerchantProduct: async (input: {
      productId: string;
      salesChannelId: string;
      stockLocationId?: string | null | undefined;
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
        return await getWriteError(response);
      }

      const data = await response.json().catch(() => undefined);

      const ownership = await productIsInSalesChannel(fetcher, options, {
        product: data?.product,
        productId: input.productId,
        salesChannelId: input.salesChannelId,
      });
      if (typeof ownership === "object") {
        return ownership as Extract<MerchantProductDetailResult, { ok: false }>;
      }
      if (!ownership) {
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

      const hydratedProduct = input.stockLocationId?.trim()
        ? ((
            await hydrateProductsWithStock(fetcher, options, {
              products: [product],
              stockLocationId: input.stockLocationId,
            })
          )[0] ?? product)
        : product;

      return {
        ok: true,
        product: hydratedProduct,
      };
    },

    listMerchantProductCategories: async (input: {
      visibility?: string | undefined;
      parentId?: string | undefined;
      limit: number;
      offset: number;
      q?: string | undefined;
      tenantId: string;
    }): Promise<MerchantProductCategoriesResult> => {
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getTenantTaxonomyUrl(options.medusaInternalUrl, "categories", input),
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
      if (!options.adminApiToken?.trim()) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getTenantTaxonomyUrl(options.medusaInternalUrl, "collections", input),
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

    findImportedProduct: async (input: {
      executionId: string;
      handle: string;
      productKey: string;
      salesChannelId: string;
    }): Promise<
      | {
          ok: true;
          product: { id: string; variantIdsBySku: Record<string, string> } | null;
        }
      | {
          ok: false;
          error:
            | "commerce_backend_unavailable"
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing"
            | "product_conflict";
          status: 401 | 409 | 503;
        }
    > => {
      if (!options.adminApiToken?.trim()) return missingCredentials();
      const url = getProductsUrl(options.medusaInternalUrl, {
        limit: 20,
        offset: 0,
        q: input.handle,
        salesChannelId: input.salesChannelId,
      });
      url.searchParams.set("fields", "id,handle,metadata,variants.id,variants.sku");
      const response = await requestMedusa(fetcher, url, {
        headers: getAdminHeaders(options.adminApiToken),
      });
      if (!response.ok) {
        return mapMedusaHttpFailure(response, {
          invalidError: "commerce_backend_unavailable",
        }) as {
          ok: false;
          error:
            | "commerce_backend_unavailable"
            | "commerce_credentials_invalid"
            | "commerce_credentials_missing";
          status: 401 | 503;
        };
      }
      const data = await response.json().catch(() => undefined);
      const products: Record<string, unknown>[] = Array.isArray(data?.products)
        ? (data.products as unknown[]).filter(isRecord)
        : [];
      const product = products.find(
        (candidate) => getString(candidate.handle)?.toLowerCase() === input.handle.toLowerCase(),
      );
      if (!product) return { ok: true, product: null };
      const metadata = isRecord(product.metadata) ? product.metadata : {};
      if (
        getString(metadata.ecs_import_execution_id) !== input.executionId ||
        getString(metadata.ecs_import_product_key) !== input.productKey
      ) {
        return { ok: false, error: "product_conflict", status: 409 };
      }
      const id = getString(product.id);
      if (!id) return { ok: false, error: "commerce_backend_unavailable", status: 503 };
      const variants: Record<string, unknown>[] = Array.isArray(product.variants)
        ? (product.variants as unknown[]).filter(isRecord)
        : [];
      return {
        ok: true,
        product: {
          id,
          variantIdsBySku: Object.fromEntries(
            variants.flatMap((variant) => {
              const sku = getString(variant.sku);
              const variantId = getString(variant.id);
              return sku && variantId ? [[sku.toLowerCase(), variantId] as const] : [];
            }),
          ),
        },
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
        getProductOwnershipUrl(options.medusaInternalUrl, input.productId, {
          includeOptions: input.options !== undefined,
        }),
        {
          headers: getAdminHeaders(options.adminApiToken),
        },
      );

      if (!retrieveResponse.ok) {
        return await getWriteError(retrieveResponse);
      }

      const retrieveData = await retrieveResponse.json().catch(() => undefined);

      const ownership = await productIsInSalesChannel(fetcher, options, {
        product: retrieveData?.product,
        productId: input.productId,
        salesChannelId: input.salesChannelId,
      });
      if (typeof ownership === "object") {
        return ownership as Extract<MerchantProductWriteResult, { ok: false }>;
      }
      if (!ownership) {
        return {
          ok: false,
          error: "product_not_found",
          status: 404,
        };
      }

      const optionBatch = splitProductOptionBatchBody(
        getProductOptionBatchBody(retrieveData?.product, input.options),
      );
      const updateResponse = await requestMedusa(
        fetcher,
        getPlatformProductUpdateUrl(options.medusaInternalUrl, input.productId),
        {
          body: JSON.stringify({
            ...(optionBatch.beforeProductUpdate
              ? { before_options: optionBatch.beforeProductUpdate }
              : {}),
            update: getProductWriteBody({
              ...input,
              variants: completeVariantOptionsForCurrentProduct(
                retrieveData?.product,
                input.variants,
              ),
            }),
            ...(optionBatch.afterProductUpdate
              ? { after_options: optionBatch.afterProductUpdate }
              : {}),
          }),
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        },
      );
      const result = await parseProductWriteResponse(updateResponse);

      if (!result.ok) {
        return result;
      }

      if (!input.stockLocationId?.trim() || !input.variants?.length) {
        return result;
      }

      await initializeProductStockLevels(fetcher, options, {
        productId: result.product.id,
        salesChannelId: input.salesChannelId,
        stockLocationId: input.stockLocationId,
        variants: input.variants,
      });

      return result;
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

      const ownership = await productIsInSalesChannel(fetcher, options, {
        product: retrieveData?.product,
        productId: input.productId,
        salesChannelId: input.salesChannelId,
      });
      if (typeof ownership === "object") {
        return ownership as Extract<MerchantDeleteResult, { ok: false }>;
      }
      if (!ownership) {
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
