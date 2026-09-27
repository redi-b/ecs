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
  previewToken?: string;
  requestHost?: string | null;
}): Promise<StorefrontConfigResult> {
  // Everything below is transport: an unreachable API, a refused connection, an
  // unresolvable base URL or an unreadable body. None of those are exceptional for
  // a function whose declared return type is a result object, so they are reported
  // as one instead of escaping as a TypeError. Without this, any platform outage
  // turned every page that resolves config — including the 404 page — into an
  // unhandled 500 instead of the system-state screen callers already handle.
  let response: Response;
  try {
    const request = new Request(getConfigUrl(options.platformApiBaseUrl, options.previewToken), {
      headers: getStorefrontHeaders(options.requestHost),
    });
    response = await (options.fetcher ?? fetch)(request);
  } catch (error) {
    console.error("[storefront] published storefront config unreachable", error);
    return {
      ok: false,
      status: 503,
      message: customerFacingStoreError("config_request_failed"),
    };
  }

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

function getConfigUrl(platformApiBaseUrl: string, previewToken?: string) {
  const url = new URL(
    previewToken ? "/platform/storefront/preview-config" : "/platform/storefront/config",
    normalizeBaseUrl(platformApiBaseUrl),
  );
  if (previewToken) url.searchParams.set("token", previewToken);
  return url;
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
