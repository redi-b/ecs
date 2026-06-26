import type {
  MerchantProduct,
  MerchantProductsResult,
  MerchantProductWriteResult,
} from "../app.js";

type ProductWriteInput = {
  handle?: string | null | undefined;
  salesChannelId: string;
  status?: string | null | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
};

type ProductUpdateInput = ProductWriteInput & {
  productId: string;
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

function getProductWriteBody(input: ProductWriteInput) {
  return Object.fromEntries(
    [
      ["title", input.title],
      ["handle", input.handle],
      ["status", input.status],
      ["thumbnail", input.thumbnail],
    ].filter(([, value]) => typeof value === "string" && value.trim()),
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
    "id,title,handle,status,thumbnail,created_at,updated_at,sales_channels.id",
  );
  url.searchParams.set("sales_channel_id[]", input.salesChannelId);

  return url;
}

function getProductsBaseUrl(medusaInternalUrl: string) {
  return new URL("/admin/products", normalizeBaseUrl(medusaInternalUrl));
}

function getProductUrl(medusaInternalUrl: string, productId: string) {
  return new URL(
    `/admin/products/${encodeURIComponent(productId)}`,
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
      title: getString(value.title),
      handle: getString(value.handle),
      status: getString(value.status),
      thumbnail: getString(value.thumbnail),
      createdAt: getString(value.created_at),
      updatedAt: getString(value.updated_at),
    },
  ];
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
