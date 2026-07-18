export const storeErrorStatus = {
  shop_context_required: 400,
  shop_not_found: 404,
  shop_unpublished: 404,
  shop_suspended: 403,
  domain_misconfigured: 409,
} as const;

export const templateSelectionErrorStatus = {
  template_not_found: 404,
  tenant_not_found: 404,
  template_plan_unavailable: 403,
} as const;

export function getRequestHost(host?: string): string | undefined {
  return host?.split(",")[0]?.trim();
}

export function getForwardHeaders(request: Request, publishableKey: string): Headers {
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-forwarded-for");
  // Avoid hop-by-hop / compression mismatches when proxying Medusa responses.
  headers.delete("accept-encoding");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.set("x-publishable-api-key", publishableKey);

  return headers;
}

export function getForwardUrl(request: Request, medusaInternalUrl: string): URL {
  const incomingUrl = new URL(request.url);
  const medusaUrl = new URL(medusaInternalUrl);

  medusaUrl.pathname = incomingUrl.pathname;
  medusaUrl.search = incomingUrl.search;

  return medusaUrl;
}

export function getForwardBody(request: Request): BodyInit | undefined {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  return request.body ?? undefined;
}

export function isAllowedStoreFacadeRoute(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/store/products") {
    return true;
  }

  if (method === "GET" && /^\/store\/products\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "GET" && path === "/store/collections") {
    return true;
  }

  if (method === "GET" && /^\/store\/collections\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "GET" && path === "/store/product-categories") {
    return true;
  }

  if (method === "GET" && /^\/store\/product-categories\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "POST" && path === "/store/carts") {
    return true;
  }

  if (method === "GET" && /^\/store\/carts\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "POST" && /^\/store\/carts\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "POST" && /^\/store\/carts\/[^/]+\/complete$/.test(path)) {
    return true;
  }

  if (method === "GET" && path === "/store/shipping-options") {
    return true;
  }

  if (method === "GET" && path === "/store/payment-providers") {
    return true;
  }

  if (method === "POST" && /^\/store\/payment-collections\/[^/]+\/payment-sessions$/.test(path)) {
    return true;
  }

  if (method === "POST" && /^\/store\/carts\/[^/]+\/shipping-methods$/.test(path)) {
    return true;
  }

  if (method === "POST" && /^\/store\/carts\/[^/]+\/line-items$/.test(path)) {
    return true;
  }

  if (method === "POST" && /^\/store\/carts\/[^/]+\/line-items\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "DELETE" && /^\/store\/carts\/[^/]+\/line-items\/[^/]+$/.test(path)) {
    return true;
  }

  return false;
}

export function getPaginationValue(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function getOptionalBodyString(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

export function getOptionalBodyNumber(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getOptionalBodyStringArray(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim());
}

export function getRequiredBodyString(body: unknown, key: string) {
  const value = getOptionalBodyString(body, key);

  return value === null ? undefined : value;
}

export async function getJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
