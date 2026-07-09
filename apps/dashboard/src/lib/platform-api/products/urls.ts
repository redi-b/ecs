import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export function getProductsUrl(options: {
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";
  const url = new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));

  if (typeof options.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }

  if (typeof options.offset === "number") {
    url.searchParams.set("offset", String(options.offset));
  }

  return url;
}

export function getProductResourceUrl(options: {
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  resource: "product-categories" | "product-collections";
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/${options.resource}`
    : `/platform/merchant/${options.resource}`;
  const url = new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));

  url.searchParams.set("limit", String(options.limit ?? 100));
  url.searchParams.set("offset", String(options.offset ?? 0));

  return url;
}

export function getProductResourceMutationUrl(options: {
  platformApiBaseUrl: string;
  resource: "product-categories" | "product-collections";
  tenantId?: string | null | undefined;
}) {
  const path = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/${options.resource}`
    : `/platform/merchant/${options.resource}`;

  return new URL(path, normalizeBaseUrl(options.platformApiBaseUrl));
}

export function getProductMutationUrl(options: {
  platformApiBaseUrl: string;
  productId?: string | undefined;
  tenantId?: string | null | undefined;
}) {
  const basePath = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";
  const productPath = options.productId
    ? `${basePath}/${encodeURIComponent(options.productId)}`
    : basePath;

  return new URL(productPath, normalizeBaseUrl(options.platformApiBaseUrl));
}

export function getProductStockUrl(options: {
  platformApiBaseUrl: string;
  productId: string;
  tenantId?: string | null | undefined;
}) {
  const basePath = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";

  return new URL(
    `${basePath}/${encodeURIComponent(options.productId)}/stock`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}

export function getProductVariantStockUrl(options: {
  platformApiBaseUrl: string;
  productId: string;
  tenantId?: string | null | undefined;
  variantId: string;
}) {
  const basePath = options.tenantId?.trim()
    ? `/platform/tenants/${encodeURIComponent(options.tenantId.trim())}/products`
    : "/platform/merchant/products";

  return new URL(
    `${basePath}/${encodeURIComponent(options.productId)}/variants/${encodeURIComponent(
      options.variantId,
    )}/stock`,
    normalizeBaseUrl(options.platformApiBaseUrl),
  );
}

export function getProductHeaders(options: {
  cookieHeader?: string | null | undefined;
  contentType?: boolean | undefined;
  requestHost?: string | null | undefined;
}) {
  return createPlatformHeaders({
    contentType: options.contentType ? "json" : false,
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}

