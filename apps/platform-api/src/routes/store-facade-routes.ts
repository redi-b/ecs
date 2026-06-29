import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../app.js";
import { completeCodCheckout } from "./cod-checkout.js";
import {
  getForwardHeaders,
  getForwardUrl,
  getRequestHost,
  isAllowedStoreFacadeRoute,
  storeErrorStatus,
} from "./shared.js";

type StoreForwardRequestResult =
  | {
      ok: true;
      request: Request;
    }
  | {
      ok: false;
      error: string;
      status: 400 | 409;
    };

function getStorePath(request: Request) {
  return new URL(request.url).pathname;
}

async function getOptionalJsonObjectBody(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {};
  }

  const parsed = JSON.parse(rawBody);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object body.");
  }

  return parsed as Record<string, unknown>;
}

async function getTenantScopedStoreForwardRequest(options: {
  medusaInternalUrl: string;
  medusaPublishableKeyId: string;
  medusaRegionId: string | null;
  request: Request;
}): Promise<StoreForwardRequestResult> {
  const method = options.request.method;
  const path = getStorePath(options.request);
  const medusaUrl = getForwardUrl(options.request, options.medusaInternalUrl);
  const headers = getForwardHeaders(options.request, options.medusaPublishableKeyId);
  let body: BodyInit | null | undefined =
    method === "GET" || method === "HEAD" ? undefined : options.request.body;

  if (method === "POST" && path === "/store/carts") {
    if (!options.medusaRegionId) {
      return {
        ok: false,
        error: "commerce_region_unavailable",
        status: 409,
      };
    }

    try {
      body = JSON.stringify({
        ...(await getOptionalJsonObjectBody(options.request)),
        region_id: options.medusaRegionId,
      });
      headers.set("content-type", "application/json");
      headers.delete("content-length");
    } catch {
      return {
        ok: false,
        error: "invalid_store_request",
        status: 400,
      };
    }
  }

  if (method === "GET" && path === "/store/payment-providers") {
    if (!options.medusaRegionId) {
      return {
        ok: false,
        error: "commerce_region_unavailable",
        status: 409,
      };
    }

    medusaUrl.searchParams.set("region_id", options.medusaRegionId);
  }

  return {
    ok: true,
    request: new Request(medusaUrl, {
      body,
      duplex: "half",
      headers,
      method,
      redirect: "manual",
    } as RequestInit),
  };
}

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

    if (
      context.req.raw.method === "GET" &&
      new URL(context.req.raw.url).pathname === "/store/delivery"
    ) {
      if (!options.getDeliverySettings) {
        return context.json({ error: "delivery_settings_unavailable" }, 503);
      }

      const delivery = await options.getDeliverySettings({
        tenantId: result.context.tenantId,
      });

      return context.json({
        delivery: {
          deliveryEnabled: delivery.delivery.deliveryEnabled,
          pickupEnabled: delivery.delivery.pickupEnabled,
          phoneConfirmationRequired: delivery.delivery.phoneConfirmationRequired,
          notesEnabled: delivery.delivery.notesEnabled,
          landmarkRequired: delivery.delivery.landmarkRequired,
          defaultDeliveryFee: delivery.delivery.defaultDeliveryFee,
          currency: delivery.delivery.currency,
          zones: delivery.delivery.zones,
        },
      });
    }

    if (!result.context.medusaPublishableKeyId) {
      return context.json({ error: "domain_misconfigured" }, 409);
    }

    if (
      context.req.raw.method === "POST" &&
      new URL(context.req.raw.url).pathname === "/store/checkout/cod"
    ) {
      if (!result.context.medusaRegionId) {
        return context.json({ error: "commerce_region_unavailable" }, 409);
      }

      if (!options.getDeliverySettings) {
        return context.json({ error: "delivery_settings_unavailable" }, 503);
      }

      try {
        return await completeCodCheckout({
          delivery: options.getDeliverySettings,
          medusaInternalUrl: options.medusaInternalUrl,
          medusaPublishableKeyId: result.context.medusaPublishableKeyId,
          medusaStoreFetch,
          request: context.req.raw,
          tenantId: result.context.tenantId,
        });
      } catch {
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      }
    }

    if (!isAllowedStoreFacadeRoute(context.req.raw)) {
      return context.json({ error: "store_route_not_allowed" }, 404);
    }

    const forwardRequest = await getTenantScopedStoreForwardRequest({
      medusaInternalUrl: options.medusaInternalUrl,
      medusaPublishableKeyId: result.context.medusaPublishableKeyId,
      medusaRegionId: result.context.medusaRegionId,
      request: context.req.raw,
    });

    if (!forwardRequest.ok) {
      return context.json({ error: forwardRequest.error }, forwardRequest.status);
    }

    try {
      const medusaResponse = await medusaStoreFetch(forwardRequest.request);

      return new Response(medusaResponse.body, {
        headers: medusaResponse.headers,
        status: medusaResponse.status,
        statusText: medusaResponse.statusText,
      });
    } catch {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
  });
}
