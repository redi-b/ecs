import {
  type PublishedStorefrontConfig,
  platformErrorSchema,
  publishedStorefrontConfigSchema,
} from "@ecs/contracts";

import { customerFacingStoreError } from "./commerce/errors.js";

export type StorefrontConfigResult =
  | {
      ok: true;
      config: PublishedStorefrontConfig;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export type StorefrontConfigFetch = (request: Request) => Promise<Response>;

export async function getPublishedStorefrontConfig(options: {
  fetcher?: StorefrontConfigFetch;
  platformApiBaseUrl: string;
  requestHost?: string | null;
}): Promise<StorefrontConfigResult> {
  const fetcher = options.fetcher ?? fetch;
  const request = new Request(getConfigUrl(options.platformApiBaseUrl), {
    headers: getStorefrontHeaders(options.requestHost),
  });
  const response = await fetcher(request);
  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);

    return {
      ok: false,
      status: response.status,
      message: customerFacingStoreError(
        error.success ? error.data.error : response.statusText || "config_request_failed",
      ),
    };
  }

  const parsed = publishedStorefrontConfigSchema.safeParse(data);

  if (!parsed.success) {
    return {
      ok: false,
      status: 502,
      message: customerFacingStoreError("invalid_storefront_config_response"),
    };
  }

  return {
    ok: true,
    config: parsed.data,
  };
}

function getConfigUrl(platformApiBaseUrl: string) {
  return new URL("/platform/storefront/config", normalizeBaseUrl(platformApiBaseUrl));
}

function getStorefrontHeaders(requestHost?: string | null) {
  const headers = new Headers();

  if (requestHost?.trim()) {
    headers.set("x-forwarded-host", requestHost.trim());
  }

  return headers;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
