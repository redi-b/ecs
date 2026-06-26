import { Hono } from "hono";

import type { TenantResolutionResult } from "./tenancy/tenant-resolver.js";

export type DashboardActorRole = "owner" | "manager" | "staff" | "operator";

export type PlatformSessionUser = {
  id: string;
  email: string;
  name: string;
};

export type PlatformSession = {
  user: PlatformSessionUser;
};

export type PlatformSignInEmailResult = {
  headers: Headers;
  response: unknown;
};

export type MerchantProduct = {
  id: string;
  title: string | null;
  handle: string | null;
  status: string | null;
  thumbnail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantProductsResult =
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      products: MerchantProduct[];
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable" | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type MerchantProductWriteResult =
  | {
      ok: true;
      product: MerchantProduct;
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable" | "commerce_credentials_missing" | "product_not_found";
      status: 401 | 404 | 503;
    };

export type MerchantOrder = {
  id: string;
  displayId: number | null;
  email: string | null;
  status: string | null;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  currencyCode: string | null;
  total: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MerchantOrdersResult =
  | {
      ok: true;
      count: number;
      limit: number;
      offset: number;
      orders: MerchantOrder[];
    }
  | {
      ok: false;
      error: "commerce_backend_unavailable" | "commerce_credentials_missing";
      status: 401 | 503;
    };

export type StorefrontTemplateCatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  previewAssetId: string | null;
  tags: unknown;
  minimumPlanId: string | null;
  version: {
    id: string;
    version: number;
    templateKey: string;
    previewData: unknown;
  };
};

export type StorefrontTemplateSelectionResult =
  | {
      ok: true;
      draft: {
        tenantId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
      };
    }
  | {
      ok: false;
      error: "template_not_found" | "tenant_not_found" | "template_plan_unavailable";
    };

export type PublishedStorefrontConfigResult =
  | {
      ok: true;
      config: {
        publishedRevisionId: string;
        templateId: string;
        templateVersion: number;
        templateKey: string;
        data: unknown;
        themeTokens: unknown;
        publishedAt: string | null;
      };
    }
  | {
      ok: false;
      error: "published_revision_not_found";
    };

export type DashboardAuthorizationResult =
  | {
      ok: true;
      actor: {
        id: string;
        email: string;
        name: string | null;
        role: DashboardActorRole;
      };
    }
  | {
      ok: false;
    };

export type PlatformAppOptions = {
  authorizeDashboardForTenant?:
    | ((input: { tenantId: string; userId: string }) => Promise<DashboardAuthorizationResult>)
    | undefined;
  authHandler?: ((request: Request) => Promise<Response>) | undefined;
  getSession?: ((headers: Headers) => Promise<PlatformSession | null>) | undefined;
  getPublishedStorefrontConfig?:
    | ((input: {
        publishedRevisionId: string;
        tenantId: string;
      }) => Promise<PublishedStorefrontConfigResult>)
    | undefined;
  createMerchantProduct?:
    | ((input: {
        handle?: string | null | undefined;
        salesChannelId: string;
        status?: string | null | undefined;
        thumbnail?: string | null | undefined;
        title: string;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  listStorefrontTemplates?: (() => Promise<StorefrontTemplateCatalogItem[]>) | undefined;
  listMerchantProducts?:
    | ((input: {
        limit: number;
        offset: number;
        salesChannelId: string;
      }) => Promise<MerchantProductsResult>)
    | undefined;
  listMerchantOrders?:
    | ((input: {
        limit: number;
        offset: number;
        salesChannelId: string;
      }) => Promise<MerchantOrdersResult>)
    | undefined;
  selectStorefrontTemplate?:
    | ((input: {
        tenantId: string;
        templateKey: string;
        userId: string;
      }) => Promise<StorefrontTemplateSelectionResult>)
    | undefined;
  updateMerchantProduct?:
    | ((input: {
        handle?: string | null | undefined;
        productId: string;
        salesChannelId: string;
        status?: string | null | undefined;
        thumbnail?: string | null | undefined;
        title?: string | null | undefined;
      }) => Promise<MerchantProductWriteResult>)
    | undefined;
  signInWithEmail?:
    | ((input: {
        email: string;
        password: string;
        rememberMe: boolean;
        headers: Headers;
      }) => Promise<PlatformSignInEmailResult>)
    | undefined;
  serviceName: string;
  medusaInternalUrl: string;
  medusaStoreFetch?: typeof fetch;
  resolveTenantForHost: (host?: string) => Promise<TenantResolutionResult>;
};

type PlatformAppVariables = {
  requestId: string;
};

const storeErrorStatus = {
  shop_context_required: 400,
  shop_not_found: 404,
  shop_unpublished: 404,
  shop_suspended: 403,
  domain_misconfigured: 409,
} as const;

const templateSelectionErrorStatus = {
  template_not_found: 404,
  tenant_not_found: 404,
  template_plan_unavailable: 403,
} as const;

function getRequestHost(host?: string): string | undefined {
  return host?.split(",")[0]?.trim();
}

function createRequestId() {
  return crypto.randomUUID();
}

async function maybeAttachRequestIdToErrorBody(response: Response, requestId: string) {
  if (
    response.status < 400 ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    return response;
  }

  const data = await response
    .clone()
    .json()
    .catch(() => undefined);

  if (typeof data !== "object" || data === null || !("error" in data) || "requestId" in data) {
    return response;
  }

  return new Response(
    JSON.stringify({
      ...data,
      requestId,
    }),
    {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    },
  );
}

function getForwardHeaders(request: Request, publishableKey: string): Headers {
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-forwarded-for");
  headers.set("x-publishable-api-key", publishableKey);

  return headers;
}

function getForwardUrl(request: Request, medusaInternalUrl: string): URL {
  const incomingUrl = new URL(request.url);
  const medusaUrl = new URL(medusaInternalUrl);

  medusaUrl.pathname = incomingUrl.pathname;
  medusaUrl.search = incomingUrl.search;

  return medusaUrl;
}

function getForwardBody(request: Request): BodyInit | undefined {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  return request.body ?? undefined;
}

function isAllowedStoreFacadeRoute(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/store/products") {
    return true;
  }

  if (method === "GET" && /^\/store\/products\/[^/]+$/.test(path)) {
    return true;
  }

  if (method === "POST" && path === "/store/carts") {
    return true;
  }

  if (method === "GET" && /^\/store\/carts\/[^/]+$/.test(path)) {
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

function getSetCookieValues(headers: Headers) {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = headersWithSetCookie.getSetCookie?.();

  if (cookies?.length) {
    return cookies;
  }

  const cookie = headers.get("set-cookie");

  return cookie ? [cookie] : [];
}

function getAuthErrorStatus(error: unknown): 401 | 503 {
  if (typeof error !== "object" || error === null) {
    return 503;
  }

  const status = "status" in error ? error.status : undefined;

  return status === 401 ? 401 : 503;
}

function getPaginationValue(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function getOptionalBodyString(body: unknown, key: string) {
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

function getRequiredBodyString(body: unknown, key: string) {
  const value = getOptionalBodyString(body, key);

  return value === null ? undefined : value;
}

async function getJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createPlatformApp(options: PlatformAppOptions) {
  const app = new Hono<{ Variables: PlatformAppVariables }>();
  const medusaStoreFetch = options.medusaStoreFetch ?? fetch;

  app.use("*", async (context, next) => {
    const incomingRequestId = context.req.raw.headers.get("x-request-id")?.trim();
    const requestId = incomingRequestId || createRequestId();
    context.set("requestId", requestId);

    await next();

    context.res.headers.set("x-request-id", requestId);

    if (incomingRequestId && !new URL(context.req.raw.url).pathname.startsWith("/store/")) {
      context.res = await maybeAttachRequestIdToErrorBody(context.res, requestId);
      context.res.headers.set("x-request-id", requestId);
    }
  });

  if (options.authHandler) {
    const authHandler = options.authHandler;

    app.on(["GET", "POST"], "/platform/auth/*", (context) => authHandler(context.req.raw));
  }

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: options.serviceName,
    }),
  );

  app.get("/platform/health", (context) =>
    context.json({
      ok: true,
      service: options.serviceName,
    }),
  );

  app.get("/platform/me", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    return context.json({
      user: session.user,
    });
  });

  app.get("/platform/storefront/templates", async (context) => {
    if (!options.listStorefrontTemplates) {
      return context.json({ error: "storefront_templates_unavailable" }, 503);
    }

    const templates = await options.listStorefrontTemplates();

    return context.json({
      templates,
    });
  });

  app.get("/platform/storefront/config", async (context) => {
    if (!options.getPublishedStorefrontConfig) {
      return context.json({ error: "storefront_config_unavailable" }, 503);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const config = await options.getPublishedStorefrontConfig({
      tenantId: result.context.tenantId,
      publishedRevisionId: result.context.publishedRevisionId,
    });

    if (!config.ok) {
      return context.json({ error: config.error }, 404);
    }

    return context.json({
      tenant: {
        id: result.context.tenantId,
        name: result.context.tenantName,
        handle: result.context.tenantHandle,
        status: result.context.status,
        domain: {
          id: result.context.domainId,
          hostname: result.context.hostname,
        },
      },
      storefront: config.config,
    });
  });

  app.post("/platform/tenants/:tenantId/storefront/template/select", async (context) => {
    if (!options.selectStorefrontTemplate) {
      return context.json({ error: "storefront_templates_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    let body: unknown;

    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_request" }, 400);
    }

    const templateKey =
      typeof body === "object" && body !== null && "templateKey" in body ? body.templateKey : null;

    if (typeof templateKey !== "string" || !templateKey.trim()) {
      return context.json({ error: "missing_template_key" }, 400);
    }

    const result = await options.selectStorefrontTemplate({
      tenantId,
      templateKey: templateKey.trim(),
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, templateSelectionErrorStatus[result.error]);
    }

    return context.json({
      draft: result.draft,
    });
  });

  app.post("/platform/sessions/email-password", async (context) => {
    if (!options.signInWithEmail) {
      return context.json({ error: "auth_unavailable" }, 503);
    }

    let body: unknown;

    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_request" }, 400);
    }

    const email = typeof body === "object" && body !== null && "email" in body ? body.email : null;
    const password =
      typeof body === "object" && body !== null && "password" in body ? body.password : null;

    if (typeof email !== "string" || !email.trim()) {
      return context.json({ error: "missing_email" }, 400);
    }

    if (typeof password !== "string" || !password) {
      return context.json({ error: "missing_password" }, 400);
    }

    try {
      const result = await options.signInWithEmail({
        email: email.trim().toLowerCase(),
        password,
        rememberMe: true,
        headers: context.req.raw.headers,
      });
      const response = context.json(result.response ?? { ok: true });

      for (const cookie of getSetCookieValues(result.headers)) {
        response.headers.append("set-cookie", cookie);
      }

      return response;
    } catch (error) {
      const status = getAuthErrorStatus(error);

      return context.json(
        { error: status === 401 ? "invalid_credentials" : "auth_unavailable" },
        status,
      );
    }
  });

  app.get("/platform/merchant/dashboard", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json(
        {
          error: result.error,
        },
        storeErrorStatus[result.error],
      );
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    return context.json({
      tenant: {
        id: result.context.tenantId,
        name: result.context.tenantName,
        handle: result.context.tenantHandle,
        status: result.context.status,
      },
      domain: {
        id: result.context.domainId,
        hostname: result.context.hostname,
      },
      actor: authorization.actor,
      commerce: {
        hasPublishableKey: Boolean(result.context.medusaPublishableKeyId),
        hasSalesChannel: Boolean(result.context.medusaSalesChannelId),
        hasStore: Boolean(result.context.medusaStoreId),
      },
      storefront: {
        isPublished: Boolean(result.context.publishedRevisionId),
        publishedRevisionId: result.context.publishedRevisionId,
        templateId: result.context.templateId,
        templateVersion: result.context.templateVersion,
      },
    });
  });

  app.post("/platform/merchant/products", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.createMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const title = getRequiredBodyString(body, "title");

    if (!title) {
      return context.json({ error: "missing_title" }, 400);
    }

    const product = await options.createMerchantProduct({
      title,
      handle: getOptionalBodyString(body, "handle"),
      status: getOptionalBodyString(body, "status"),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.get("/platform/merchant/orders", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.listMerchantOrders) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const orders = await options.listMerchantOrders({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!orders.ok) {
      return context.json({ error: orders.error }, orders.status);
    }

    return context.json({
      orders: orders.orders,
      count: orders.count,
      limit: orders.limit,
      offset: orders.offset,
    });
  });

  app.get("/platform/merchant/products", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.listMerchantProducts) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const products = await options.listMerchantProducts({
      limit: getPaginationValue(context.req.query("limit"), 20, 100),
      offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!products.ok) {
      return context.json({ error: products.error }, products.status);
    }

    return context.json({
      products: products.products,
      count: products.count,
      limit: products.limit,
      offset: products.offset,
    });
  });

  app.post("/platform/merchant/products/:productId", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: result.context.tenantId,
      userId: session.user.id,
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    if (!result.context.medusaSalesChannelId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!options.updateMerchantProduct) {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    const body = await getJsonBody(context.req.raw);
    const product = await options.updateMerchantProduct({
      productId: context.req.param("productId"),
      title: getOptionalBodyString(body, "title"),
      handle: getOptionalBodyString(body, "handle"),
      status: getOptionalBodyString(body, "status"),
      thumbnail: getOptionalBodyString(body, "thumbnail"),
      salesChannelId: result.context.medusaSalesChannelId,
    });

    if (!product.ok) {
      return context.json({ error: product.error }, product.status);
    }

    return context.json({
      product: product.product,
    });
  });

  app.all("/store/*", async (context) => {
    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json(
        {
          error: result.error,
        },
        storeErrorStatus[result.error],
      );
    }

    if (!result.context.medusaPublishableKeyId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (!isAllowedStoreFacadeRoute(context.req.raw)) {
      return context.json({ error: "store_route_not_allowed" }, 404);
    }

    let medusaResponse: Response;

    try {
      medusaResponse = await medusaStoreFetch(
        new Request(getForwardUrl(context.req.raw, options.medusaInternalUrl), {
          body: getForwardBody(context.req.raw),
          duplex: "half",
          headers: getForwardHeaders(context.req.raw, result.context.medusaPublishableKeyId),
          method: context.req.raw.method,
          redirect: "manual",
        } as RequestInit),
      );
    } catch {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }

    return new Response(medusaResponse.body, {
      headers: medusaResponse.headers,
      status: medusaResponse.status,
      statusText: medusaResponse.statusText,
    });
  });

  return app;
}
