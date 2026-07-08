import type {
  MerchantProduct,
  MerchantProductCategoriesResult,
  MerchantProductCategory,
  MerchantProductCategoryWriteResult,
  MerchantProductCollection,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductDetailResult,
  MerchantProductStock,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
  MerchantDeleteResult,
  MerchantBatchDeleteResult,
} from "../app.js";

type ProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  imageUrls?: string[] | undefined;
  options?: ProductOptionInput[] | undefined;
  priceAmount?: number | undefined;
  regionId?: string | null | undefined;
  salesChannelId: string;
  status?: string | null | undefined;
  stockLocationId?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
  variants?: ProductVariantWriteInput[] | undefined;
};

type ProductOptionInput = {
  title: string;
  values: string[];
};

type ProductVariantWriteInput = {
  currencyCode: string;
  optionValues: Record<string, string>;
  priceAmount: number;
  sku?: string | null | undefined;
  stockedQuantity?: number | undefined;
};

type ProductUpdateInput = ProductWriteInput & {
  productId: string;
};

type ProductCategoryWriteInput = {
  handle?: string | null | undefined;
  name: string;
  tenantId: string;
};

type ProductCollectionWriteInput = {
  handle?: string | null | undefined;
  tenantId: string;
  title: string;
};

type ProductStockInput = {
  productId: string;
  salesChannelId: string;
  stockLocationId: string;
};

type ProductStockUpdateInput = ProductStockInput & {
  stockedQuantity: number;
};

type ProductVariantStockInput = ProductStockInput & {
  variantId: string;
};

type ProductVariantStockUpdateInput = ProductVariantStockInput & {
  stockedQuantity: number;
};

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
        }),
        headers: getAdminHeaders(options.adminApiToken),
        method: "POST",
      });

      const result = await parseProductWriteResponse(response);

      if (!result.ok || !input.stockLocationId?.trim()) {
        return result;
      }

      const initialized = await initializeProductStockLevel(fetcher, options, {
        productId: result.product.id,
        salesChannelId: input.salesChannelId,
        stockLocationId: input.stockLocationId,
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
            is_active: true,
            is_internal: false,
            metadata: getTenantMetadata(input.tenantId),
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
            metadata: getTenantMetadata(input.tenantId),
          }),
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        },
      );

      return parseProductCollectionWriteResponse(response);
    },

    listMerchantProducts: async (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
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

      return {
        ok: true,
        count: getNumber(data?.count) ?? 0,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
        products: Array.isArray(data?.products) ? data.products.flatMap(normalizeProduct) : [],
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
        new URL(`/admin/products/${encodeURIComponent(input.productId)}`, normalizeBaseUrl(options.medusaInternalUrl)),
        {
          headers: getAdminHeaders(options.adminApiToken!),
          method: "DELETE",
        }
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
        input.salesChannelId
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
        }
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

      const ownership = await categoryBelongsToTenantById(fetcher, options, input.categoryId, input.tenantId);
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
          normalizeBaseUrl(options.medusaInternalUrl)
        ),
        {
          headers: getAdminHeaders(options.adminApiToken!),
          method: "DELETE",
        }
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
          categoryBelongsToTenantById(fetcher, options, id, input.tenantId)
        )
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
              normalizeBaseUrl(options.medusaInternalUrl)
            ),
            {
              headers: getAdminHeaders(options.adminApiToken!),
              method: "DELETE",
            }
          );
          return parseDeleteResponse(response, "category");
        })
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

      const ownership = await collectionBelongsToTenantById(fetcher, options, input.collectionId, input.tenantId);
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
          normalizeBaseUrl(options.medusaInternalUrl)
        ),
        {
          headers: getAdminHeaders(options.adminApiToken!),
          method: "DELETE",
        }
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
          collectionBelongsToTenantById(fetcher, options, id, input.tenantId)
        )
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
              normalizeBaseUrl(options.medusaInternalUrl)
            ),
            {
              headers: getAdminHeaders(options.adminApiToken!),
              method: "DELETE",
            }
          );
          return parseDeleteResponse(response, "collection");
        })
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

async function requestMedusa(fetcher: typeof fetch, input: URL, init: RequestInit) {
  try {
    return await fetcher(input, init);
  } catch {
    return Response.json({}, { status: 503 });
  }
}

function getAdminHeaders(adminApiToken: string) {
  return {
    accept: "application/json",
    authorization: `Basic ${adminApiToken}`,
    "content-type": "application/json",
  };
}

async function getProductInventoryContext(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: ProductStockInput,
): Promise<
  | {
      ok: true;
      inventoryItemId: string;
      variantId: string;
    }
  | Extract<MerchantProductStockResult, { ok: false }>
> {
  const response = await requestMedusa(
    fetcher,
    getProductInventoryUrl(options.medusaInternalUrl, input.productId),
    {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
    },
  );

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "product_not_found",
      status: 404,
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

  if (!productBelongsToSalesChannel(data?.product, input.salesChannelId)) {
    return {
      ok: false,
      error: "product_not_found",
      status: 404,
    };
  }

  const inventory = getSingleVariantInventoryItem(data?.product);

  if (inventory === "multiple_variants") {
    return {
      ok: false,
      error: "product_variant_unsupported",
      status: 409,
    };
  }

  if (!inventory) {
    return {
      ok: false,
      error: "product_inventory_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    ...inventory,
  };
}

async function getProductVariantInventoryContext(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: ProductVariantStockInput,
): Promise<
  | {
      ok: true;
      inventoryItemId: string;
      variantId: string;
    }
  | Extract<MerchantProductStockResult, { ok: false }>
> {
  const response = await requestMedusa(
    fetcher,
    getProductInventoryUrl(options.medusaInternalUrl, input.productId),
    {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
    },
  );

  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "product_not_found",
      status: 404,
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

  if (!productBelongsToSalesChannel(data?.product, input.salesChannelId)) {
    return {
      ok: false,
      error: "product_not_found",
      status: 404,
    };
  }

  const inventory = getVariantInventoryItem(data?.product, input.variantId);

  if (!inventory) {
    return {
      ok: false,
      error: "product_inventory_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    ...inventory,
  };
}

async function getInventoryItemStock(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    inventoryItemId: string;
    productId: string;
    stockLocationId: string;
    variantId: string;
  },
): Promise<MerchantProductStockResult> {
  const response = await requestMedusa(
    fetcher,
    getInventoryItemUrl(options.medusaInternalUrl, input.inventoryItemId),
    {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
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
  const stock = normalizeProductStock({
    inventoryItemId: input.inventoryItemId,
    productId: input.productId,
    stockLocationId: input.stockLocationId,
    variantId: input.variantId,
    value: data?.inventory_item,
  });

  if (!stock && !isRecord(data?.inventory_item)) {
    return {
      ok: false,
      error: "product_inventory_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    stock: stock ?? getEmptyProductStock(input),
  };
}

async function writeInventoryItemStockLevel(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    inventoryItemId: string;
    stockLocationId: string;
    stockedQuantity: number;
  },
) {
  const response = await requestMedusa(
    fetcher,
    getInventoryItemLevelUrl(options.medusaInternalUrl, {
      inventoryItemId: input.inventoryItemId,
      stockLocationId: input.stockLocationId,
    }),
    {
      body: JSON.stringify({
        stocked_quantity: input.stockedQuantity,
      }),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    },
  );

  if (response.status !== 404) {
    return response;
  }

  return requestMedusa(
    fetcher,
    getInventoryItemLevelsUrl(options.medusaInternalUrl, input.inventoryItemId),
    {
      body: JSON.stringify({
        location_id: input.stockLocationId,
        stocked_quantity: input.stockedQuantity,
      }),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    },
  );
}

function getEmptyProductStock(input: {
  inventoryItemId: string;
  productId: string;
  stockLocationId: string;
  variantId: string;
}): MerchantProductStock {
  return {
    productId: input.productId,
    variantId: input.variantId,
    inventoryItemId: input.inventoryItemId,
    locationId: input.stockLocationId,
    stockedQuantity: 0,
    reservedQuantity: 0,
    incomingQuantity: 0,
    availableQuantity: 0,
  };
}

async function initializeProductStockLevel(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    productId: string;
    salesChannelId: string;
    stockLocationId: string;
  },
) {
  const inventory = await getProductInventoryContext(fetcher, options, {
    productId: input.productId,
    salesChannelId: input.salesChannelId,
    stockLocationId: input.stockLocationId,
  });

  if (!inventory.ok) {
    return false;
  }

  const response = await requestMedusa(
    fetcher,
    getInventoryItemLevelsUrl(options.medusaInternalUrl, inventory.inventoryItemId),
    {
      body: JSON.stringify({
        location_id: input.stockLocationId,
        stocked_quantity: 0,
      }),
      headers: getAdminHeaders(options.adminApiToken ?? ""),
      method: "POST",
    },
  );

  return response.ok;
}

function getProductWriteBody(input: ProductWriteInput) {
  const body = Object.fromEntries(
    [
      ["title", input.title],
      ["description", input.description],
      ["handle", input.handle],
      ["collection_id", input.collectionId],
      ["status", input.status],
      ["thumbnail", input.thumbnail],
    ].filter(([, value]) => typeof value === "string" && value.trim()),
  );

  if (input.categoryIds?.length) {
    body.categories = input.categoryIds.map((id) => ({ id }));
  }

  if (input.imageUrls?.length) {
    body.images = input.imageUrls.map((url) => ({ url }));
  }

  if (input.priceAmount !== undefined) {
    const productOptions = getProductOptionsForWrite(input.options);
    const productVariants = getProductVariantsForWrite(input.variants);

    body.options = productOptions;
    body.variants = productVariants.length
      ? productVariants.map((variant) => getProductVariantWriteBody(variant, input.regionId))
      : getProductVariantCombinations(productOptions).map((combination) =>
          getProductVariantWriteBody(
            {
              optionValues: Object.fromEntries(
                combination.map((option) => [option.title, option.value]),
              ),
              priceAmount: input.priceAmount ?? 0,
              currencyCode: input.currencyCode?.trim().toLowerCase() || "etb",
            },
            input.regionId,
          ),
        );
  }

  return body;
}

function getProductOptionsForWrite(options: ProductOptionInput[] | undefined) {
  const normalized = (options ?? [])
    .map((option) => ({
      title: option.title.trim(),
      values: [...new Set(option.values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((option) => option.title && option.values.length);

  return normalized.length
    ? normalized
    : [
        {
          title: "Default",
          values: ["Default"],
        },
      ];
}

function getProductVariantsForWrite(variants: ProductVariantWriteInput[] | undefined) {
  return (variants ?? []).filter(
    (variant) =>
      Number.isFinite(variant.priceAmount) &&
      Object.keys(variant.optionValues).length > 0 &&
      variant.currencyCode.trim(),
  );
}

function getProductVariantWriteBody(
  variant: ProductVariantWriteInput,
  regionId: string | null | undefined,
) {
  const optionValues = Object.fromEntries(
    Object.entries(variant.optionValues)
      .map(([title, value]) => [title.trim(), value.trim()])
      .filter(([title, value]) => title && value),
  );

  return {
    title: Object.values(optionValues).join(" / ") || "Default",
    ...(variant.sku?.trim() ? { sku: variant.sku.trim() } : {}),
    options: optionValues,
    prices: [
      {
        amount: variant.priceAmount,
        currency_code: variant.currencyCode.trim().toLowerCase(),
        ...(regionId?.trim()
          ? {
              rules: {
                region_id: regionId,
              },
            }
          : {}),
      },
    ],
  };
}

function getProductVariantCombinations(options: ProductOptionInput[]) {
  return options.reduce<Array<Array<{ title: string; value: string }>>>(
    (combinations, option) =>
      combinations.flatMap((combination) =>
        option.values.map((value) => [...combination, { title: option.title, value }]),
      ),
    [[]],
  );
}

async function parseProductWriteResponse(response: Response): Promise<MerchantProductWriteResult> {
  if (!response.ok) {
    return getWriteError(response);
  }

  const data = await response.json().catch(() => undefined);
  const product = normalizeProduct(data?.product)[0];

  if (!product) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    product,
  };
}

async function parseProductCategoryWriteResponse(
  response: Response,
): Promise<MerchantProductCategoryWriteResult> {
  if (!response.ok) {
    return getCategoryWriteError(response);
  }

  const data = await response.json().catch(() => undefined);
  const category = normalizeProductCategory(data?.product_category)[0];

  if (!category) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    category,
  };
}

async function parseProductCollectionWriteResponse(
  response: Response,
): Promise<MerchantProductCollectionWriteResult> {
  if (!response.ok) {
    return getCollectionWriteError(response);
  }

  const data = await response.json().catch(() => undefined);
  const collection = normalizeProductCollection(data?.collection)[0];

  if (!collection) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    collection,
  };
}

function getWriteError(response: Response): MerchantProductWriteResult {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "product_not_found",
      status: 404,
    };
  }

  if (response.status === 409) {
    return {
      ok: false,
      error: "product_conflict",
      status: 409,
    };
  }

  if (response.status === 400 || response.status === 422) {
    return {
      ok: false,
      error: "product_write_invalid",
      status: response.status,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

function getCategoryWriteError(response: Response): MerchantProductCategoryWriteResult {
  if (response.status === 401) {
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

function getCollectionWriteError(response: Response): MerchantProductCollectionWriteResult {
  if (response.status === 401) {
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

function getStockWriteError(response: Response): MerchantProductStockUpdateResult {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "product_inventory_unavailable",
      status: 503,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

function missingCredentials() {
  return {
    ok: false,
    error: "commerce_credentials_missing",
    status: 503,
  } as const;
}

function getProductsUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number; salesChannelId: string },
) {
  const url = getProductsBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set(
    "fields",
    "id,title,description,handle,status,thumbnail,collection_id,categories.id,images.id,images.url,images.rank,images.created_at,images.updated_at,variants.id,variants.title,variants.sku,variants.options.value,variants.options.option.title,variants.prices.amount,variants.prices.currency_code,created_at,updated_at,sales_channels.id",
  );
  url.searchParams.set("sales_channel_id[]", input.salesChannelId);

  return url;
}

function getProductsBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/products", normalizeBaseUrl(medusaInternalUrl));
}

function getProductDetailUrl(medusaInternalUrl: string, productId: string) {
  const url = getProductUrl(medusaInternalUrl, productId);

  url.searchParams.set(
    "fields",
    "id,title,description,handle,status,thumbnail,collection_id,categories.id,images.id,images.url,images.rank,images.created_at,images.updated_at,variants.id,variants.title,variants.sku,variants.options.value,variants.options.option.title,variants.prices.amount,variants.prices.currency_code,variants.inventory_items.inventory_item_id,created_at,updated_at,sales_channels.id",
  );

  return url;
}

function getProductCategoriesUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number },
) {
  const url = getProductCategoriesBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set(
    "fields",
    "id,name,handle,is_active,is_internal,parent_category_id,metadata,created_at,updated_at",
  );

  return url;
}

function getProductCategoriesBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/product-categories", normalizeBaseUrl(medusaInternalUrl));
}

function getProductCollectionsUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number },
) {
  const url = getProductCollectionsBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("order", "-created_at");
  url.searchParams.set("fields", "id,title,handle,metadata,created_at,updated_at");

  return url;
}

function getProductCollectionsBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/collections", normalizeBaseUrl(medusaInternalUrl));
}

function getProductUrl(medusaInternalUrl: string, productId: string) {
  return new URL(
    `/admin/products/${encodeURIComponent(productId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

function getProductInventoryUrl(medusaInternalUrl: string, productId: string) {
  const url = getProductUrl(medusaInternalUrl, productId);

  url.searchParams.set(
    "fields",
    "id,sales_channels.id,variants.id,variants.inventory_items.inventory_item_id",
  );

  return url;
}

function getInventoryItemUrl(medusaInternalUrl: string, inventoryItemId: string) {
  const url = new URL(
    `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );

  url.searchParams.set("fields", "id,*location_levels");

  return url;
}

function getInventoryItemLevelsUrl(medusaInternalUrl: string, inventoryItemId: string) {
  return new URL(
    `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

function getInventoryItemLevelUrl(
  medusaInternalUrl: string,
  input: { inventoryItemId: string; stockLocationId: string },
) {
  return new URL(
    `/admin/inventory-items/${encodeURIComponent(input.inventoryItemId)}/location-levels/${encodeURIComponent(input.stockLocationId)}`,
    normalizeBaseUrl(medusaInternalUrl),
  );
}

function getProductOwnershipUrl(medusaInternalUrl: string, productId: string) {
  const url = getProductUrl(medusaInternalUrl, productId);

  url.searchParams.set("fields", "id,sales_channels.id");

  return url;
}

function getProductOwnershipListUrl(
  medusaInternalUrl: string,
  input: { productId: string; salesChannelId: string },
) {
  const url = getProductsBaseUrl(medusaInternalUrl);

  url.searchParams.set("limit", "1");
  url.searchParams.set("offset", "0");
  url.searchParams.set("fields", "id");
  url.searchParams.set("id[]", input.productId);
  url.searchParams.set("sales_channel_id[]", input.salesChannelId);

  return url;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function productBelongsToSalesChannel(product: unknown, salesChannelId: string) {
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

async function productIsInSalesChannel(
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

async function productExistsInSalesChannel(
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

function normalizeProduct(value: unknown): MerchantProduct[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  const images = getProductImages(value.images);

  return [
    {
      id,
      categoryIds: getProductCategoryIds(value.categories),
      collectionId: getString(value.collection_id),
      description: getString(value.description),
      title: getString(value.title),
      handle: getString(value.handle),
      status: getString(value.status),
      thumbnail: getString(value.thumbnail),
      ...(images.length === 0 ? {} : { images }),
      variants: getProductVariants(value.variants),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

function getProductCategoryIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((category) => (isRecord(category) ? getString(category.id) : null))
    .filter((id): id is string => Boolean(id));
}

function getProductImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((image) => {
    if (!isRecord(image)) {
      return [];
    }

    const id = getString(image.id);

    if (!id) {
      return [];
    }

    return [
      {
        id,
        url: getString(image.url),
        rank: getNumber(image.rank) ?? null,
        createdAt: getString(image.created_at),
        updatedAt: getString(image.updated_at),
      },
    ];
  });
}

function getProductVariants(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((variant) => {
    if (!isRecord(variant)) {
      return [];
    }

    const id = getString(variant.id);

    if (!id) {
      return [];
    }

    const optionValues = getProductVariantOptionValues(variant.options);

    return [
      {
        id,
        inventoryItemId: getVariantInventoryItemId(variant),
        title: getString(variant.title),
        sku: getString(variant.sku),
        ...(optionValues.length === 0 ? {} : { optionValues }),
        prices: getProductPrices(variant.prices),
      },
    ];
  });
}

function getProductVariantOptionValues(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((optionValue) => {
    if (!isRecord(optionValue)) {
      return [];
    }

    const value = getString(optionValue.value);
    const optionTitle = isRecord(optionValue.option)
      ? getString(optionValue.option.title)
      : getString(optionValue.option_title);

    if (!value && !optionTitle) {
      return [];
    }

    return [
      {
        optionTitle,
        value,
      },
    ];
  });
}

function getSingleVariantInventoryItem(product: unknown) {
  if (!isRecord(product) || !Array.isArray(product.variants)) {
    return undefined;
  }

  const variants = product.variants.filter(isRecord);

  if (variants.length !== 1) {
    return variants.length > 1 ? "multiple_variants" : undefined;
  }

  const variant = variants[0];

  if (!variant) {
    return undefined;
  }

  const variantId = getString(variant.id);
  const inventoryItemId = getVariantInventoryItemId(variant);

  if (variantId && inventoryItemId) {
    return {
      variantId,
      inventoryItemId,
    };
  }

  return undefined;
}

function getVariantInventoryItem(product: unknown, variantId: string) {
  if (!isRecord(product) || !Array.isArray(product.variants)) {
    return undefined;
  }

  const variant = product.variants
    .filter(isRecord)
    .find((candidate) => getString(candidate.id) === variantId);

  if (!variant) {
    return undefined;
  }

  const inventoryItemId = getVariantInventoryItemId(variant);

  if (!inventoryItemId) {
    return undefined;
  }

  return {
    variantId,
    inventoryItemId,
  };
}

function getVariantInventoryItemId(variant: Record<string, unknown>) {
  if (!Array.isArray(variant.inventory_items)) {
    return null;
  }

  for (const inventoryItem of variant.inventory_items) {
    if (!isRecord(inventoryItem)) {
      continue;
    }

    const inventoryItemId =
      getString(inventoryItem.inventory_item_id) ?? getString(inventoryItem.id);

    if (inventoryItemId) {
      return inventoryItemId;
    }
  }

  return null;
}

function normalizeProductStock(input: {
  inventoryItemId: string;
  productId: string;
  stockLocationId: string;
  value: unknown;
  variantId: string;
}): MerchantProductStock | undefined {
  if (!isRecord(input.value) || !Array.isArray(input.value.location_levels)) {
    return undefined;
  }

  const level = input.value.location_levels.find(
    (candidate) => isRecord(candidate) && candidate.location_id === input.stockLocationId,
  );

  if (!isRecord(level)) {
    return undefined;
  }

  return {
    productId: input.productId,
    variantId: input.variantId,
    inventoryItemId: input.inventoryItemId,
    locationId: input.stockLocationId,
    stockedQuantity: getNumber(level.stocked_quantity) ?? null,
    reservedQuantity: getNumber(level.reserved_quantity) ?? null,
    incomingQuantity: getNumber(level.incoming_quantity) ?? null,
    availableQuantity: getNumber(level.available_quantity) ?? null,
  };
}

function getProductPrices(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((price) => {
    if (!isRecord(price)) {
      return [];
    }

    return [
      {
        amount: getNumber(price.amount) ?? null,
        currencyCode: getString(price.currency_code),
      },
    ];
  });
}

function normalizeProductCategory(value: unknown): MerchantProductCategory[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  return [
    {
      id,
      name: getString(value.name),
      handle: getString(value.handle),
      isActive: getBoolean(value.is_active),
      isInternal: getBoolean(value.is_internal),
      parentCategoryId: getString(value.parent_category_id),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

function normalizeProductCollection(value: unknown): MerchantProductCollection[] {
  if (!isRecord(value)) {
    return [];
  }

  const id = getString(value.id);

  if (!id) {
    return [];
  }

  return [
    {
      id,
      title: getString(value.title),
      handle: getString(value.handle),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
}

function belongsToTenant(value: unknown, tenantId: string) {
  if (!isRecord(value) || !isRecord(value.metadata)) {
    return false;
  }

  return value.metadata.platform_tenant_id === tenantId;
}

function getTenantMetadata(tenantId: string) {
  return {
    platform_tenant_id: tenantId,
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

async function isMissingCommerceResourceResponse(response: Response) {
  const data = await response.json().catch(() => undefined);
  const message = getErrorMessage(data);

  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();

  return (
    /(sales channel|sales_channel|sales-channel|product category|category|collection|inventory item|inventory_item|stock location|location|price list|price_list|price set|price_set|product|price).*(not found|does not exist|missing)/.test(
      normalized,
    ) ||
    /(not found|does not exist|missing).*(sales channel|sales_channel|sales-channel|product category|category|collection|inventory item|inventory_item|stock location|location|price list|price_list|price set|price_set|product|price)/.test(
      normalized,
    )
  );
}

function getErrorMessage(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  return (
    getString(value.message) ??
    getString(value.error) ??
    getString(value.type) ??
    getString(value.code)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function categoryBelongsToTenantById(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  categoryId: string,
  tenantId: string,
): Promise<
  | boolean
  | { ok: false; error: "commerce_credentials_invalid" | "commerce_backend_unavailable"; status: 401 | 503 }
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

async function collectionBelongsToTenantById(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  collectionId: string,
  tenantId: string,
): Promise<
  | boolean
  | { ok: false; error: "commerce_credentials_invalid" | "commerce_backend_unavailable"; status: 401 | 503 }
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

async function filterProductIdsBySalesChannel(
  fetcher: typeof fetch,
  options: { adminApiToken?: string | undefined; medusaInternalUrl: string },
  productIds: string[],
  salesChannelId: string,
): Promise<
  | string[]
  | { ok: false; error: "commerce_credentials_invalid" | "commerce_backend_unavailable"; status: 401 | 503 }
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

function getDeleteError(
  response: Response,
  resourceName: "product" | "category" | "collection",
): Extract<MerchantDeleteResult, { ok: false }> {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `${resourceName}_not_found` as const,
      status: 404,
    };
  }

  return {
    ok: false,
    error: "commerce_backend_unavailable",
    status: 503,
  };
}

async function parseDeleteResponse(
  response: Response,
  resourceName: "product" | "category" | "collection",
): Promise<MerchantDeleteResult> {
  if (response.status === 401) {
    return {
      ok: false,
      error: "commerce_credentials_invalid",
      status: 401,
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `${resourceName}_not_found` as const,
      status: 404,
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
  const id = getString(data?.id);
  const deleted = getBoolean(data?.deleted) ?? false;

  if (!id) {
    return {
      ok: false,
      error: "commerce_backend_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    id,
    deleted,
  };
}

async function parseBatchDeleteResponse(
  response: Response,
  requestedIds: string[],
): Promise<MerchantBatchDeleteResult> {
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
  const deletedIds = Array.isArray(data?.deleted)
    ? data.deleted.filter((id: unknown): id is string => typeof id === "string")
    : requestedIds;

  return {
    ok: true,
    ids: deletedIds,
    deleted: true,
  };
}
