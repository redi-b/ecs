import type {
  MerchantProduct,
  MerchantProductStock,
  MerchantProductStockResult,
  MerchantProductStockUpdateResult,
} from "../../../types/index.js";
import { mapMedusaHttpFailure } from "../map-medusa-failure.js";
import { getAdminHeaders, requestMedusa } from "./medusa-http.js";
import {
  getSingleVariantInventoryItem,
  getVariantInventoryItem,
  getVariantInventoryItemId,
  normalizeProductStock,
} from "./normalize.js";
import { productBelongsToSalesChannel } from "./ownership.js";
import type {
  ProductStockInput,
  ProductVariantStockInput,
  ProductVariantWriteInput,
} from "./types.js";
import {
  getInventoryItemLevelsUrl,
  getInventoryItemLevelUrl,
  getInventoryItemUrl,
  getProductInventoryUrl,
} from "./urls.js";
import { getBoolean, getNumber, getString, isRecord } from "./values.js";

export async function getProductInventoryContext(
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

export async function getProductVariantInventoryContext(
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

export async function getInventoryItemStock(
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

export async function writeInventoryItemStockLevel(
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

export function getEmptyProductStock(input: {
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

export async function hydrateProductsWithStock(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    products: MerchantProduct[];
    stockLocationId: string;
  },
) {
  // Request-scoped memo: many variants can share inventory items; list hydration
  // used to N+1 Medusa inventory-item reads for the same id.
  const inventoryStockByKey = new Map<string, Promise<MerchantProductStockResult>>();

  function loadInventoryStock(inputStock: {
    inventoryItemId: string;
    productId: string;
    variantId: string;
  }) {
    const key = `${inputStock.inventoryItemId}:${input.stockLocationId}`;
    const existing = inventoryStockByKey.get(key);

    if (existing) {
      return existing;
    }

    const pending = getInventoryItemStock(fetcher, options, {
      inventoryItemId: inputStock.inventoryItemId,
      productId: inputStock.productId,
      stockLocationId: input.stockLocationId,
      variantId: inputStock.variantId,
    });
    inventoryStockByKey.set(key, pending);

    return pending;
  }

  return Promise.all(
    input.products.map(async (product) => ({
      ...product,
      variants: await Promise.all(
        (product.variants ?? []).map(async (variant) => {
          if (!variant.inventoryItemId) {
            return {
              ...variant,
              stock: null,
            };
          }

          const result = await loadInventoryStock({
            inventoryItemId: variant.inventoryItemId,
            productId: product.id,
            variantId: variant.id,
          });

          return {
            ...variant,
            stock: result.ok ? getVariantStockSummary(result.stock) : null,
          };
        }),
      ),
    })),
  );
}

export function getVariantStockSummary(stock: MerchantProductStock) {
  return {
    locationId: stock.locationId,
    stockedQuantity: stock.stockedQuantity,
    reservedQuantity: stock.reservedQuantity,
    incomingQuantity: stock.incomingQuantity,
    availableQuantity: stock.availableQuantity,
  };
}

export async function initializeProductStockLevels(
  fetcher: typeof fetch,
  options: {
    adminApiToken?: string | undefined;
    medusaInternalUrl: string;
  },
  input: {
    productId: string;
    salesChannelId: string;
    stockLocationId: string;
    variants?: ProductVariantWriteInput[] | undefined;
  },
) {
  const response = await requestMedusa(
    fetcher,
    getProductInventoryUrl(options.medusaInternalUrl, input.productId),
    {
      headers: getAdminHeaders(options.adminApiToken ?? ""),
    },
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json().catch(() => undefined);

  if (!productBelongsToSalesChannel(data?.product, input.salesChannelId)) {
    return false;
  }

  const variants: Array<Record<string, unknown>> =
    isRecord(data?.product) && Array.isArray(data.product.variants)
      ? data.product.variants.filter(isRecord)
      : [];
  const results = await Promise.all(
    variants.map((variant, index) => {
      const inventoryItemId = getVariantInventoryItemId(variant);

      if (!inventoryItemId) {
        return Promise.resolve(false);
      }

      return writeInventoryItemStockLevel(fetcher, options, {
        inventoryItemId,
        stockLocationId: input.stockLocationId,
        stockedQuantity: input.variants?.[index]?.stockedQuantity ?? 0,
      }).then((levelResponse) => levelResponse.ok);
    }),
  );

  return results.some(Boolean);
}

export function getStockWriteError(response: Response): MerchantProductStockUpdateResult {
  // Inventory 404 is setup incompleteness (level missing), not a merchant validation mistake.
  if (response.status === 404) {
    return {
      ok: false,
      error: "product_inventory_unavailable",
      status: 503,
    };
  }

  return mapMedusaHttpFailure(response, {
    invalidError: "invalid_stocked_quantity",
    notFoundError: "product_inventory_unavailable",
  }) as Extract<MerchantProductStockUpdateResult, { ok: false }>;
}
