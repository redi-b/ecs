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
  serviceName: string;
  medusaInternalUrl: string;
  medusaStoreFetch?: typeof fetch;
  resolveTenantForHost: (host?: string) => Promise<TenantResolutionResult>;
};

const storeErrorStatus = {
  shop_context_required: 400,
  shop_not_found: 404,
  shop_unpublished: 404,
  shop_suspended: 403,
  domain_misconfigured: 409,
} as const;

function getRequestHost(host?: string): string | undefined {
  return host?.split(",")[0]?.trim();
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

export function createPlatformApp(options: PlatformAppOptions) {
  const app = new Hono();
  const medusaStoreFetch = options.medusaStoreFetch ?? fetch;

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
