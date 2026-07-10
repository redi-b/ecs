/**
 * Shared Platform API request helpers for dashboard server code.
 *
 * Feature modules should use these for base URL, cookie, and host forwarding
 * instead of re-implementing header/URL construction per resource.
 */

export type PlatformRequestContext = {
  cookieHeader?: string | null | undefined;
  platformApiBaseUrl?: string | null | undefined;
  requestHost?: string | null | undefined;
};

export function getPlatformApiBaseUrl(value?: string | null | undefined) {
  return normalizeBaseUrl(
    value?.trim() || process.env.PLATFORM_API_BASE_URL || "http://localhost:3000",
  );
}

export function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function createPlatformHeaders(options: {
  cookieHeader?: string | null | undefined;
  contentType?: "json" | string | false | undefined;
  requestHost?: string | null | undefined;
}) {
  const headers = new Headers();

  if (options.contentType === "json") {
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
  } else if (typeof options.contentType === "string" && options.contentType) {
    headers.set("content-type", options.contentType);
  }

  if (options.cookieHeader?.trim()) {
    headers.set("cookie", options.cookieHeader.trim());
  }

  if (options.requestHost?.trim()) {
    headers.set("x-forwarded-host", options.requestHost.trim());
  }

  return headers;
}

/**
 * Resolve a merchant resource path for host-scoped or tenant-id-scoped APIs.
 * Prefer host-scoped `/platform/merchant/*` when no tenantId is selected.
 */
export function getMerchantResourcePath(
  resource: string,
  options?: {
    id?: string | null | undefined;
    suffix?: string | null | undefined;
    tenantId?: string | null | undefined;
  },
) {
  const tenantId = options?.tenantId?.trim();
  const base = tenantId
    ? `/platform/tenants/${encodeURIComponent(tenantId)}/${resource}`
    : `/platform/merchant/${resource}`;

  let path = base;

  if (options?.id) {
    path = `${path}/${encodeURIComponent(options.id)}`;
  }

  if (options?.suffix) {
    path = `${path}/${options.suffix.replace(/^\/+/, "")}`;
  }

  return path;
}

export function createPlatformUrl(
  path: string,
  platformApiBaseUrl?: string | null | undefined,
  searchParams?: Record<string, string | number | undefined | null>,
) {
  const url = new URL(
    path.startsWith("/") ? path.slice(1) : path,
    getPlatformApiBaseUrl(platformApiBaseUrl),
  );

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export async function platformFetch(
  path: string,
  options: PlatformRequestContext & {
    body?: BodyInit | null | undefined;
    contentType?: "json" | string | false | undefined;
    fetcher?: typeof fetch;
    method?: string | undefined;
    searchParams?: Record<string, string | number | undefined | null>;
  } = {},
) {
  const fetcher = options.fetcher ?? fetch;
  const url = createPlatformUrl(path, options.platformApiBaseUrl, options.searchParams);
  const init: RequestInit = {
    cache: "no-store",
    headers: createPlatformHeaders({
      contentType: options.contentType,
      cookieHeader: options.cookieHeader,
      requestHost: options.requestHost,
    }),
  };

  if (options.method !== undefined) {
    init.method = options.method;
  }

  if (options.body !== undefined) {
    init.body = options.body;
  }

  return fetcher(url, init);
}
