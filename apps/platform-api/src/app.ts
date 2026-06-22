import { Hono } from "hono";

import type { TenantResolutionResult } from "./tenancy/tenant-resolver.js";

export type PlatformAppOptions = {
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

    const medusaResponse = await medusaStoreFetch(
      new Request(getForwardUrl(context.req.raw, options.medusaInternalUrl), {
        body: getForwardBody(context.req.raw),
        duplex: "half",
        headers: getForwardHeaders(context.req.raw, result.context.medusaPublishableKeyId),
        method: context.req.raw.method,
        redirect: "manual",
      } as RequestInit),
    );

    return new Response(medusaResponse.body, {
      headers: medusaResponse.headers,
      status: medusaResponse.status,
      statusText: medusaResponse.statusText,
    });
  });

  return app;
}
