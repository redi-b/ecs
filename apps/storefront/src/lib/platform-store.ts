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

export type StoreDeliveryOptions = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  phoneConfirmationRequired: boolean;
  notesEnabled: boolean;
  landmarkRequired: boolean;
  defaultDeliveryFee: string;
  currency: string;
  zones: unknown[];
};

export type StoreDeliveryOptionsResponse = {
  delivery: StoreDeliveryOptions;
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

export async function getStoreDeliveryOptions(
  options: ListStoreProductsOptions,
): Promise<StoreDeliveryOptionsResponse | StorefrontError> {
  const fetcher = options.fetcher ?? fetch;
  const request = new Request(getStoreDeliveryUrl(options.platformApiBaseUrl), {
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
    delivery: normalizeDeliveryOptions(isRecord(data) ? data.delivery : undefined),
  };
}

function getStoreProductsUrl(platformApiBaseUrl: string) {
  const url = new URL("/store/products", normalizeBaseUrl(platformApiBaseUrl));
  url.searchParams.set("limit", "8");
  return url;
}

function getStoreDeliveryUrl(platformApiBaseUrl: string) {
  return new URL("/store/delivery", normalizeBaseUrl(platformApiBaseUrl));
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

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeDeliveryOptions(value: unknown): StoreDeliveryOptions {
  if (!isRecord(value)) {
    return {
      deliveryEnabled: false,
      pickupEnabled: false,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: false,
      defaultDeliveryFee: "0",
      currency: "ETB",
      zones: [],
    };
  }

  return {
    deliveryEnabled: getBoolean(value.deliveryEnabled),
    pickupEnabled: getBoolean(value.pickupEnabled),
    phoneConfirmationRequired: getBoolean(value.phoneConfirmationRequired),
    notesEnabled: getBoolean(value.notesEnabled),
    landmarkRequired: getBoolean(value.landmarkRequired),
    defaultDeliveryFee: getString(value.defaultDeliveryFee) ?? "0",
    currency: getString(value.currency) ?? "ETB",
    zones: Array.isArray(value.zones) ? value.zones : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
