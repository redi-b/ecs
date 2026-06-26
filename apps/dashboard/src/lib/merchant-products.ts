import type { MerchantProduct, MerchantProducts } from "@ecs/contracts";
import {
  merchantProductMutationSchema,
  merchantProductsSchema,
  platformErrorSchema,
} from "@ecs/contracts";

export type MerchantProductsResult =
  | {
      ok: true;
      products: MerchantProducts;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductMutationResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type MerchantProductWriteInput = {
  handle?: string | null | undefined;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
};

export async function createMerchantProduct(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  product: MerchantProductWriteInput;
  requestHost?: string | null | undefined;
}): Promise<MerchantProductMutationResult> {
  const response = await sendProductMutation({
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    product: options.product,
    requestHost: options.requestHost,
  });

  return parseProductMutationResponse(response);
}

export async function getMerchantProducts(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
  requestHost?: string | null | undefined;
}): Promise<MerchantProductsResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(getProductsUrl(options), {
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      requestHost: options.requestHost,
    }),
  });
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Products request failed",
    };
  }

  const parsed = merchantProductsSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_products_response",
    };
  }

  return {
    ok: true,
    products: parsed.data,
  };
}

export async function updateMerchantProduct(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  product: MerchantProductWriteInput;
  productId: string;
  requestHost?: string | null | undefined;
}): Promise<MerchantProductMutationResult> {
  const response = await sendProductMutation({
    cookieHeader: options.cookieHeader,
    fetcher: options.fetcher,
    platformApiBaseUrl: options.platformApiBaseUrl,
    product: options.product,
    productId: options.productId,
    requestHost: options.requestHost,
  });

  return parseProductMutationResponse(response);
}

async function sendProductMutation(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch | undefined;
  platformApiBaseUrl: string;
  product: MerchantProductWriteInput;
  productId?: string | undefined;
  requestHost?: string | null | undefined;
}) {
  const fetcher = options.fetcher ?? fetch;

  return fetcher(getProductMutationUrl(options), {
    body: JSON.stringify(options.product),
    cache: "no-store",
    headers: getProductHeaders({
      cookieHeader: options.cookieHeader,
      contentType: true,
      requestHost: options.requestHost,
    }),
    method: "POST",
  });
}

async function parseProductMutationResponse(
  response: Response,
): Promise<MerchantProductMutationResult> {
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : response.statusText || "Product request failed",
    };
  }

  const parsed = merchantProductMutationSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: "invalid_product_response",
    };
  }

  return {
    ok: true,
    product: parsed.data.product,
  };
}

function getProductsUrl(options: {
  limit?: number | undefined;
  offset?: number | undefined;
  platformApiBaseUrl: string;
}) {
  const url = new URL("/platform/merchant/products", normalizeBaseUrl(options.platformApiBaseUrl));

  if (typeof options.limit === "number") {
    url.searchParams.set("limit", String(options.limit));
  }

  if (typeof options.offset === "number") {
    url.searchParams.set("offset", String(options.offset));
  }

  return url;
}

function getProductMutationUrl(options: {
  platformApiBaseUrl: string;
  productId?: string | undefined;
}) {
  const productPath = options.productId
    ? `/platform/merchant/products/${encodeURIComponent(options.productId)}`
    : "/platform/merchant/products";

  return new URL(productPath, normalizeBaseUrl(options.platformApiBaseUrl));
}

function getProductHeaders(options: {
  cookieHeader?: string | null | undefined;
  contentType?: boolean | undefined;
  requestHost?: string | null | undefined;
}) {
  const headers = new Headers();

  if (options.contentType) {
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
  }

  if (options.cookieHeader?.trim()) {
    headers.set("cookie", options.cookieHeader.trim());
  }

  if (options.requestHost?.trim()) {
    headers.set("x-forwarded-host", options.requestHost.trim());
  }

  return headers;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
