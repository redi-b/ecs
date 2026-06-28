import { Hono } from "hono";

import { registerMerchantRoutes } from "./routes/merchant-routes.js";
import { registerPlatformRoutes } from "./routes/platform-routes.js";
import { registerStoreFacadeRoutes } from "./routes/store-facade-routes.js";
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

export type TenantDomain = {
  id: string;
  hostname: string;
  type: string;
  status: string;
  isPrimary: boolean;
  verificationStatus: string;
  sslStatus: string;
};

export type TenantDomainListResult = {
  ok: true;
  domains: TenantDomain[];
};

export type TenantDomainCreateResult =
  | {
      ok: true;
      domain: TenantDomain;
    }
  | {
      ok: false;
      error: "domain_invalid" | "domain_unavailable";
      status: 400 | 409;
    };

export type TenantOnboardingResult =
  | {
      ok: true;
      onboarding: {
        tenantId: string;
        status: string;
        currentStep: string;
        completedSteps: unknown;
      };
    }
  | {
      ok: false;
      error: "onboarding_not_found";
    };

export type TenantShopProvisioningResult =
  | {
      ok: true;
      tenant: {
        id: string;
        name: string;
        handle: string;
        status: string;
        primaryDomain: {
          hostname: string;
        };
      };
    }
  | {
      ok: false;
      error:
        | "commerce_backend_unavailable"
        | "handle_invalid"
        | "handle_reserved"
        | "handle_unavailable"
        | "storefront_template_unavailable";
      status: 400 | 409 | 503;
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
  getTenantOnboarding?:
    | ((input: { tenantId: string }) => Promise<TenantOnboardingResult>)
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
  createTenantShop?:
    | ((input: {
        handle: string;
        name: string;
        ownerUserId: string;
      }) => Promise<TenantShopProvisioningResult>)
    | undefined;
  createTenantDomain?:
    | ((input: {
        hostname: string;
        tenantId: string;
        userId: string;
      }) => Promise<TenantDomainCreateResult>)
    | undefined;
  listStorefrontTemplates?: (() => Promise<StorefrontTemplateCatalogItem[]>) | undefined;
  listTenantDomains?:
    | ((input: { tenantId: string }) => Promise<TenantDomainListResult>)
    | undefined;
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
  serviceName: string;
  medusaInternalUrl: string;
  medusaStoreFetch?: typeof fetch;
  resolveTenantForHost: (host?: string) => Promise<TenantResolutionResult>;
};

export type PlatformAppVariables = {
  requestId: string;
};

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

  registerPlatformRoutes(app, options);
  registerMerchantRoutes(app, options);
  registerStoreFacadeRoutes(app, options, medusaStoreFetch);

  return app;
}
