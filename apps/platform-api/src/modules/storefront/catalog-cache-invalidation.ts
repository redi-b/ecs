/**
 * After catalog writes (products, stock, taxonomy), drop public storefront HTML
 * for the tenant so shoppers never browse intentionally stale pages.
 */
import { purgeStorefrontTenantCache } from "./cache-purge.js";

type OkResult = { ok: boolean };

function getStringField(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve tenant id from a catalog write input.
 * Taxonomy writes carry tenantId; product/stock writes carry salesChannelId.
 */
export async function resolveTenantIdForCatalogWrite(
  input: unknown,
  resolveTenantIdBySalesChannelId: (salesChannelId: string) => Promise<string | null>,
): Promise<string | null> {
  const tenantId = getStringField(input, "tenantId");
  if (tenantId) return tenantId;

  const salesChannelId = getStringField(input, "salesChannelId");
  if (!salesChannelId) return null;

  return resolveTenantIdBySalesChannelId(salesChannelId);
}

export async function purgeAfterSuccessfulCatalogWrite(input: {
  tenantId: string | null;
  reason?: string;
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
}): Promise<void> {
  if (!input.tenantId) return;
  const payload: {
    tenantId: string;
    logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
  } = { tenantId: input.tenantId };
  if (input.logger) {
    payload.logger = input.logger;
  }
  await purgeStorefrontTenantCache(payload);
}

/**
 * Wrap an async catalog write so a successful mutation purges storefront HTML.
 */
export function withStorefrontCatalogPurge<TInput, TResult extends OkResult>(
  fn: (input: TInput) => Promise<TResult>,
  options: {
    resolveTenantIdBySalesChannelId: (salesChannelId: string) => Promise<string | null>;
    logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
  },
): (input: TInput) => Promise<TResult> {
  return async (input: TInput) => {
    const result = await fn(input);
    if (!result.ok) {
      return result;
    }

    const tenantId = await resolveTenantIdForCatalogWrite(
      input,
      options.resolveTenantIdBySalesChannelId,
    );

    if (tenantId) {
      const purgeInput: {
        tenantId: string;
        logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
      } = { tenantId };
      if (options.logger) {
        purgeInput.logger = options.logger;
      }
      await purgeAfterSuccessfulCatalogWrite(purgeInput);
    }

    return result;
  };
}

/** Product-service method names that change public storefront catalog HTML. */
export const PRODUCT_SERVICE_CATALOG_WRITE_METHODS = [
  "createMerchantProduct",
  "updateMerchantProduct",
  "deleteMerchantProduct",
  "deleteMerchantProductsBatch",
  "updateMerchantProductStock",
  "updateMerchantProductVariantStock",
  "createMerchantProductCategory",
  "updateMerchantProductCategory",
  "deleteMerchantProductCategory",
  "deleteMerchantProductCategoriesBatch",
  "reorderMerchantProductCategories",
  "createMerchantProductCollection",
  "updateMerchantProductCollection",
  "deleteMerchantProductCollection",
  "deleteMerchantProductCollectionsBatch",
  "updateMerchantCollectionProducts",
] as const;

export type ProductServiceCatalogWriteMethod =
  (typeof PRODUCT_SERVICE_CATALOG_WRITE_METHODS)[number];

/**
 * Return a product service where catalog write methods purge storefront cache on success.
 * Read methods are left untouched.
 */
export function wrapProductServiceWithStorefrontPurge<T extends Record<string, unknown>>(
  productService: T,
  options: {
    resolveTenantIdBySalesChannelId: (salesChannelId: string) => Promise<string | null>;
    logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
  },
): T {
  const wrapped = { ...productService };

  for (const methodName of PRODUCT_SERVICE_CATALOG_WRITE_METHODS) {
    const original = productService[methodName];
    if (typeof original !== "function") {
      continue;
    }

    (wrapped as Record<string, unknown>)[methodName] = withStorefrontCatalogPurge(
      original.bind(productService) as (input: unknown) => Promise<OkResult>,
      options,
    );
  }

  return wrapped;
}
