export type StoreProduct = {
  id: string;
  title: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  description?: string | null;
};

export type StoreProductsResponse = {
  products: StoreProduct[];
  count?: number;
  limit?: number;
  offset?: number;
};

export type StorefrontError = {
  ok: false;
  status: number;
  message: string;
};

export type StorefrontFetch = (request: Request) => Promise<Response>;

export type ListStoreProductsOptions = {
  fetcher?: StorefrontFetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
};

export async function listStoreProducts(
  options: ListStoreProductsOptions,
): Promise<StoreProductsResponse | StorefrontError> {
  const fetcher = options.fetcher ?? fetch;
  const request = new Request(getStoreProductsUrl(options.platformApiBaseUrl), {
    headers: getStoreHeaders(options.requestHost),
  });
  const response = await fetcher(request);
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: getErrorMessage(data, response.statusText),
    };
  }

  return {
    count: getNumber(data?.count),
    limit: getNumber(data?.limit),
    offset: getNumber(data?.offset),
    products: Array.isArray(data?.products) ? data.products.map(normalizeProduct) : [],
  };
}

function getStoreProductsUrl(platformApiBaseUrl: string) {
  const url = new URL("/store/products", normalizeBaseUrl(platformApiBaseUrl));
  url.searchParams.set("limit", "8");
  return url;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function getStoreHeaders(requestHost?: string | null) {
  const headers = new Headers();

  if (requestHost?.trim()) {
    headers.set("x-forwarded-host", requestHost.trim());
  }

  return headers;
}

function getErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data)) {
    const error = data.error ?? data.message;

    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return fallback || "Store request failed";
}

function normalizeProduct(value: unknown): StoreProduct {
  if (!isRecord(value)) {
    return {
      id: "",
      title: null,
    };
  }

  return {
    description: getString(value.description),
    handle: getString(value.handle),
    id: getString(value.id) ?? "",
    thumbnail: getString(value.thumbnail),
    title: getString(value.title),
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
