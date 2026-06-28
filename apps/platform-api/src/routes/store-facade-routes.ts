import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../app.js";
import {
  getForwardBody,
  getForwardHeaders,
  getForwardUrl,
  getRequestHost,
  isAllowedStoreFacadeRoute,
  storeErrorStatus,
} from "./shared.js";

export function registerStoreFacadeRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  medusaStoreFetch: typeof fetch,
) {
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
}
