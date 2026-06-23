import type { MerchantProduct, MerchantProductsResult } from "../app.js";

export function createMedusaProductService(options: {
  adminApiToken?: string | undefined;
  fetcher?: typeof fetch;
  medusaInternalUrl: string;
}) {
  const fetcher = options.fetcher ?? fetch;

  return {
    listMerchantProducts: async (input: {
      limit: number;
      offset: number;
      salesChannelId: string;
    }): Promise<MerchantProductsResult> => {
      if (!options.adminApiToken?.trim()) {
        return {
          ok: false,
          error: "commerce_credentials_missing",
          status: 503,
        };
      }

      let response: Response;

      try {
        response = await fetcher(getProductsUrl(options.medusaInternalUrl, input), {
          headers: {
            accept: "application/json",
            "x-medusa-access-token": options.adminApiToken,
          },
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
  };
}

function getProductsUrl(
  medusaInternalUrl: string,
  input: { limit: number; offset: number; salesChannelId: string },
) {
  const url = new URL("/admin/products", normalizeBaseUrl(medusaInternalUrl));

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

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
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
