import type {
  MerchantBatchDeleteResult,
  MerchantDeleteResult,
  MerchantProduct,
  MerchantProductDetailResult,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
} from "../../../types/index.js";
import { mapMedusaHttpFailure } from "../map-medusa-failure.js";
import { getAdminHeaders, missingCredentials, requestMedusa } from "./medusa-http.js";
import { normalizeProduct, normalizeProductStock } from "./normalize.js";
import { filterProductIdsBySalesChannel, productIsInSalesChannel } from "./ownership.js";
import {
  getInventoryItemStock,
  getProductInventoryContext,
  getProductVariantInventoryContext,
  getStockWriteError,
  hydrateProductsWithStock,
  initializeProductStockLevels,
  writeInventoryItemStockLevel,
} from "./stock.js";
import { createMedusaProductTaxonomyService } from "./taxonomy-service.js";
import type {
  ProductStockInput,
  ProductStockUpdateInput,
  ProductUpdateInput,
  ProductVariantStockInput,
  ProductVariantStockUpdateInput,
  ProductWriteInput,
} from "./types.js";
import {
  getPlatformProductUpdateUrl,
  getProductDetailUrl,
  getProductOwnershipUrl,
  getProductSearchUrl,
  getProductsBaseUrl,
  getProductsUrl,
  getProductUrl,
  normalizeBaseUrl,
} from "./urls.js";
import { getString, isMissingCommerceResourceResponse, isRecord } from "./values.js";
import {
  completeVariantOptionsForCurrentProduct,
  getDeleteError,
  getProductOptionBatchBody,
  getProductWriteBody,
  getWriteError,
  parseBatchDeleteResponse,
  parseDeleteResponse,
  parseProductWriteResponse,
  splitProductOptionBatchBody,
} from "./write.js";

export function createMedusaProductService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;
  const adminApiToken = options.adminApiToken?.trim();
  const taxonomyService = createMedusaProductTaxonomyService({ ...options, fetcher });

  return {
    ...taxonomyService,
    createMerchantProduct: async (
      input: ProductWriteInput,
    ): Promise<MerchantProductWriteResult> => {
      if (!adminApiToken) {
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
        headers: getAdminHeaders(adminApiToken),
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
      if (!adminApiToken) {
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
          { headers: getAdminHeaders(adminApiToken) },
        ).catch(() => undefined);
        if (indexed?.ok) {
          const searchData = await indexed.json().catch(() => undefined);
          const ids: Array<string | null> | null = Array.isArray(searchData?.hits)
            ? searchData.hits.map((hit: unknown) => (isRecord(hit) ? getString(hit.id) : null))
            : null;
          if (
            ids?.every((id: string | null): id is string => Boolean(id)) &&
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
              headers: getAdminHeaders(adminApiToken),
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
        { headers: getAdminHeaders(adminApiToken) },
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
      if (!adminApiToken) {
        return missingCredentials();
      }

      const response = await requestMedusa(
        fetcher,
        getProductDetailUrl(options.medusaInternalUrl, input.productId),
        {
          headers: getAdminHeaders(adminApiToken),
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
      if (!adminApiToken) return missingCredentials();
      const url = getProductsUrl(options.medusaInternalUrl, {
        limit: 20,
        offset: 0,
        q: input.handle,
        salesChannelId: input.salesChannelId,
      });
      url.searchParams.set("fields", "id,handle,metadata,variants.id,variants.sku");
      const response = await requestMedusa(fetcher, url, {
        headers: getAdminHeaders(adminApiToken),
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
      if (!adminApiToken) {
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
      if (!adminApiToken) {
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
      if (!adminApiToken) {
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
      if (!adminApiToken) {
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
      if (!adminApiToken) {
        return missingCredentials();
      }

      const retrieveResponse = await requestMedusa(
        fetcher,
        getProductOwnershipUrl(options.medusaInternalUrl, input.productId, {
          includeOptions: input.options !== undefined || input.variants !== undefined,
        }),
        {
          headers: getAdminHeaders(adminApiToken),
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
          headers: getAdminHeaders(adminApiToken),
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

    updateProductMediaVariants: async (input: {
      productId: string;
      mediaVariants: Record<string, Record<string, string>>;
      tenantId?: string;
      images?: Array<{ url: string }>;
      thumbnail?: string | null;
    }): Promise<MerchantProductWriteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const retrieveResponse = await requestMedusa(
        fetcher,
        getProductUrl(options.medusaInternalUrl, input.productId),
        {
          headers: getAdminHeaders(adminApiToken),
        },
      );

      if (!retrieveResponse.ok) {
        return await getWriteError(retrieveResponse);
      }

      const retrieveData = await retrieveResponse.json().catch(() => undefined);
      const existingMetadata = isRecord(retrieveData?.product?.metadata)
        ? retrieveData.product.metadata
        : {};
      if (
        input.tenantId &&
        existingMetadata.platform_tenant_id &&
        existingMetadata.platform_tenant_id !== input.tenantId
      ) {
        return { ok: false, error: "product_not_found", status: 404 };
      }

      const updateResponse = await requestMedusa(
        fetcher,
        getPlatformProductUpdateUrl(options.medusaInternalUrl, input.productId),
        {
          body: JSON.stringify({
            update: {
              // Medusa merges metadata keys. Do not resend a stale product metadata snapshot.
              metadata: { media_variants: input.mediaVariants },
              ...(input.thumbnail !== undefined ? { thumbnail: input.thumbnail } : {}),
              ...(input.images !== undefined ? { images: input.images } : {}),
            },
          }),
          headers: getAdminHeaders(adminApiToken),
          method: "POST",
        },
      );

      return await parseProductWriteResponse(updateResponse);
    },

    deleteMerchantProduct: async (input: {
      productId: string;
      salesChannelId: string;
    }): Promise<MerchantDeleteResult> => {
      if (!adminApiToken) {
        return missingCredentials();
      }

      const retrieveResponse = await requestMedusa(
        fetcher,
        getProductOwnershipUrl(options.medusaInternalUrl, input.productId),
        {
          headers: getAdminHeaders(adminApiToken),
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
          headers: getAdminHeaders(adminApiToken),
          method: "DELETE",
        },
      );

      return parseDeleteResponse(response, "product");
    },

    deleteMerchantProductsBatch: async (input: {
      productIds: string[];
      salesChannelId: string;
    }): Promise<MerchantBatchDeleteResult> => {
      if (!adminApiToken) {
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
          headers: getAdminHeaders(adminApiToken),
          method: "POST",
        },
      );

      return parseBatchDeleteResponse(response, verifiedIds);
    },
  };
}
