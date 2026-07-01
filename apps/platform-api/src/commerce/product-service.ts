import type {
  MerchantProduct,
  MerchantProductCategoriesResult,
  MerchantProductCategory,
  MerchantProductCategoryWriteResult,
  MerchantProductCollection,
  MerchantProductCollectionsResult,
  MerchantProductCollectionWriteResult,
  MerchantProductStock,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
  MerchantProductsResult,
  MerchantProductWriteResult,
} from "../app.js";

type ProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  priceAmount?: number | undefined;
  regionId?: string | null | undefined;
  salesChannelId: string;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
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
          sales_channels: [input.salesChannelId],
        }),
        headers: getAdminHeaders(options.adminApiToken),
        method: "POST",
      });

      return parseProductWriteResponse(response);
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
          error: "commerce_credentials_missing",
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

      return {
        ok: true,
        count: getNumber(data?.count) ?? 0,
        limit: getNumber(data?.limit) ?? input.limit,
        offset: getNumber(data?.offset) ?? input.offset,
        products: Array.isArray(data?.products) ? data.products.flatMap(normalizeProduct) : [],
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
          error: "commerce_credentials_missing",
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
          error: "commerce_credentials_missing",
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

      const response = await requestMedusa(
        fetcher,
        getInventoryItemLevelUrl(options.medusaInternalUrl, {
          inventoryItemId: inventory.inventoryItemId,
          stockLocationId: input.stockLocationId,
        }),
        {
          body: JSON.stringify({
            stocked_quantity: input.stockedQuantity,
          }),
          headers: getAdminHeaders(options.adminApiToken),
          method: "POST",
        },
      );

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

      if (!productBelongsToSalesChannel(retrieveData?.product, input.salesChannelId)) {
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
    "content-type": "application/json",
    "x-medusa-access-token": adminApiToken,
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
      error: "commerce_credentials_missing",
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

  const inventory = getFirstProductInventoryItem(data?.product);

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
      error: "commerce_credentials_missing",
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

  if (!stock) {
    return {
      ok: false,
      error: "product_inventory_unavailable",
      status: 503,
    };
  }

  return {
    ok: true,
    stock,
  };
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

  if (input.priceAmount !== undefined) {
    body.variants = [
      {
        title: "Default",
        prices: [
          {
            amount: input.priceAmount,
            currency_code: input.currencyCode?.trim().toLowerCase() || "etb",
            ...(input.regionId?.trim()
              ? {
                  rules: {
                    region_id: input.regionId,
                  },
                }
              : {}),
          },
        ],
      },
    ];
  }

  return body;
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
      error: "commerce_credentials_missing",
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
      error: "commerce_credentials_missing",
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
      error: "commerce_credentials_missing",
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
      error: "commerce_credentials_missing",
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
    "id,title,description,handle,status,thumbnail,collection_id,categories.id,variants.id,variants.title,variants.sku,variants.prices.amount,variants.prices.currency_code,created_at,updated_at,sales_channels.id",
  );
  url.searchParams.set("sales_channel_id[]", input.salesChannelId);

  return url;
}

function getProductsBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/products", normalizeBaseUrl(medusaInternalUrl));
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

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function productBelongsToSalesChannel(product: unknown, salesChannelId: string) {
  if (!isRecord(product) || !Array.isArray(product.sales_channels)) {
    return false;
  }

  return product.sales_channels.some(
    (salesChannel) => isRecord(salesChannel) && salesChannel.id === salesChannelId,
  );
}

function normalizeProduct(value: unknown): MerchantProduct[] {
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
      categoryIds: getProductCategoryIds(value.categories),
      collectionId: getString(value.collection_id),
      description: getString(value.description),
      title: getString(value.title),
      handle: getString(value.handle),
      status: getString(value.status),
      thumbnail: getString(value.thumbnail),
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

    return [
      {
        id,
        inventoryItemId: getVariantInventoryItemId(variant),
        title: getString(variant.title),
        sku: getString(variant.sku),
        prices: getProductPrices(variant.prices),
      },
    ];
  });
}

function getFirstProductInventoryItem(product: unknown) {
  if (!isRecord(product) || !Array.isArray(product.variants)) {
    return undefined;
  }

  for (const variant of product.variants) {
    if (!isRecord(variant)) {
      continue;
    }

    const variantId = getString(variant.id);
    const inventoryItemId = getVariantInventoryItemId(variant);

    if (variantId && inventoryItemId) {
      return {
        variantId,
        inventoryItemId,
      };
    }
  }

  return undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
