import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import {
  getForwardHeaders,
  getForwardUrl,
  getRequestHost,
  isAllowedStoreFacadeRoute,
  storeErrorStatus,
} from "../shared.js";
import { completeChapaCheckout, initializeChapaCheckout } from "./checkout/chapa.js";
import { completeCodCheckout } from "./checkout/cod.js";

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

async function recordStorefrontAnalyticsEvent(options: {
  recordAnalyticsEvent: NonNullable<PlatformAppOptions["recordAnalyticsEvent"]>;
  request: Request;
  tenantId: string;
}) {
  let body: Record<string, unknown>;

  try {
    body = await getOptionalJsonObjectBody(options.request);
  } catch {
    return Response.json({ error: "invalid_analytics_event" }, { status: 400 });
  }

  if (typeof body.eventType !== "string") {
    return Response.json({ error: "analytics_event_type_required" }, { status: 400 });
  }

  const event = await options.recordAnalyticsEvent({
    customerId: typeof body.customerId === "string" ? body.customerId : null,
    eventType: body.eventType,
    idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : null,
    occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : null,
    properties: body.properties,
    sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    source: "storefront",
    subjectId: typeof body.subjectId === "string" ? body.subjectId : null,
    subjectType: typeof body.subjectType === "string" ? body.subjectType : null,
    tenantId: options.tenantId,
  });

  if (!event.ok) {
    return Response.json({ error: event.error }, { status: event.status });
  }

  return Response.json(
    {
      event: {
        duplicate: event.duplicate,
        id: event.event.id,
      },
    },
    { status: 202 },
  );
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

  const init: RequestInit = {
    headers,
    method,
    redirect: "manual",
  };

  if (body !== undefined && body !== null) {
    init.body = body;
    // Required by undici when sending a body stream from an incoming Request.
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  return {
    ok: true,
    request: new Request(medusaUrl, init),
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

    if (
      context.req.raw.method === "GET" &&
      new URL(context.req.raw.url).pathname === "/store/payment-options"
    ) {
      const chapaConfigured = options.isMerchantChapaConfigured
        ? await options.isMerchantChapaConfigured({ tenantId: result.context.tenantId })
        : false;

      return context.json({
        payment: {
          cod: true,
          chapa: chapaConfigured,
        },
      });
    }

    if (
      context.req.raw.method === "POST" &&
      new URL(context.req.raw.url).pathname === "/store/analytics/events"
    ) {
      if (!options.recordAnalyticsEvent) {
        return context.json({ error: "analytics_unavailable" }, 503);
      }

      return recordStorefrontAnalyticsEvent({
        recordAnalyticsEvent: options.recordAnalyticsEvent,
        request: context.req.raw,
        tenantId: result.context.tenantId,
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
          deliveryShippingOptionId: result.context.medusaShippingOptionId,
          ensurePickupOption: options.ensurePickupOption
            ? async (input) => {
                const ensured = await options.ensurePickupOption?.(input);
                if (!ensured || !ensured.ok) return { ok: false as const };
                return { ok: true as const, pickupOptionId: ensured.pickupOptionId };
              }
            : undefined,
          medusaInternalUrl: options.medusaInternalUrl,
          medusaPublishableKeyId: result.context.medusaPublishableKeyId,
          medusaStoreFetch,
          recordAnalyticsEvent: options.recordAnalyticsEvent,
          recordNotificationEvent: options.recordNotificationEvent,
          request: context.req.raw,
          tenantId: result.context.tenantId,
        });
      } catch {
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      }
    }

    if (
      context.req.raw.method === "POST" &&
      new URL(context.req.raw.url).pathname === "/store/checkout/chapa"
    ) {
      if (!result.context.medusaRegionId) {
        return context.json({ error: "commerce_region_unavailable" }, 409);
      }

      if (!options.getMerchantChapaCredentials) {
        return context.json({ error: "merchant_chapa_not_configured" }, 409);
      }

      try {
        return await initializeChapaCheckout({
          getMerchantChapaCredentials: options.getMerchantChapaCredentials,
          medusaInternalUrl: options.medusaInternalUrl,
          medusaPublishableKeyId: result.context.medusaPublishableKeyId,
          medusaStoreFetch,
          platformPublicBaseUrl: options.platformPublicBaseUrl,
          request: context.req.raw,
          tenantId: result.context.tenantId,
        });
      } catch {
        return context.json({ error: "commerce_backend_unavailable" }, 503);
      }
    }

    if (
      context.req.raw.method === "POST" &&
      new URL(context.req.raw.url).pathname === "/store/checkout/chapa/complete"
    ) {
      if (!result.context.medusaRegionId) {
        return context.json({ error: "commerce_region_unavailable" }, 409);
      }

      if (!options.getMerchantChapaCredentials) {
        return context.json({ error: "merchant_chapa_not_configured" }, 409);
      }

      try {
        return await completeChapaCheckout({
          getMerchantChapaCredentials: options.getMerchantChapaCredentials,
          medusaInternalUrl: options.medusaInternalUrl,
          medusaPublishableKeyId: result.context.medusaPublishableKeyId,
          medusaStoreFetch,
          recordAnalyticsEvent: options.recordAnalyticsEvent,
          recordNotificationEvent: options.recordNotificationEvent,
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
      // Buffer the body so Node's server does not drop streamed undici responses mid-write
      // (seen as content-length mismatches / "Internal Server Error" for store GETs).
      const responseBody = await medusaResponse.arrayBuffer();
      const path = getStorePath(context.req.raw);
      const method = context.req.raw.method;

      // Medusa Store API returns global collections/categories. Scope to this tenant via metadata.
      if (
        medusaResponse.ok &&
        method === "GET" &&
        (path === "/store/collections" ||
          path.startsWith("/store/collections/") ||
          path === "/store/product-categories" ||
          path.startsWith("/store/product-categories/"))
      ) {
        const scoped = scopeTaxonomyResponseToTenant({
          body: responseBody,
          path,
          tenantId: result.context.tenantId,
        });
        if (!scoped.ok) {
          return context.json({ error: "not_found" }, 404);
        }
        return context.json(scoped.body, medusaResponse.status);
      }

      const responseHeaders = new Headers(medusaResponse.headers);
      responseHeaders.delete("transfer-encoding");
      responseHeaders.set("content-length", String(responseBody.byteLength));

      return new Response(responseBody, {
        headers: responseHeaders,
        status: medusaResponse.status,
        statusText: medusaResponse.statusText,
      });
    } catch {
      return context.json({ error: "commerce_backend_unavailable" }, 503);
    }
  });
}

function scopeTaxonomyResponseToTenant(input: {
  body: ArrayBuffer;
  path: string;
  tenantId: string;
}): { ok: true; body: Record<string, unknown> } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(input.body));
  } catch {
    return { ok: false };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false };
  }

  const data = parsed as Record<string, unknown>;

  if (input.path === "/store/collections") {
    const rows = Array.isArray(data.collections) ? data.collections : [];
    const collections = rows.filter((row) => taxonomyBelongsToTenant(row, input.tenantId));
    return {
      ok: true,
      body: {
        ...data,
        collections,
        count: collections.length,
      },
    };
  }

  if (input.path.startsWith("/store/collections/")) {
    const collection = data.collection;
    if (!taxonomyBelongsToTenant(collection, input.tenantId)) {
      return { ok: false };
    }
    return { ok: true, body: data };
  }

  if (input.path === "/store/product-categories") {
    const rows = Array.isArray(data.product_categories) ? data.product_categories : [];
    const product_categories = rows.filter((row) => taxonomyBelongsToTenant(row, input.tenantId));
    return {
      ok: true,
      body: {
        ...data,
        product_categories,
        count: product_categories.length,
      },
    };
  }

  if (input.path.startsWith("/store/product-categories/")) {
    const category = data.product_category;
    if (!taxonomyBelongsToTenant(category, input.tenantId)) {
      return { ok: false };
    }
    return { ok: true, body: data };
  }

  return { ok: true, body: data };
}

function taxonomyBelongsToTenant(value: unknown, tenantId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as { platform_tenant_id?: unknown }).platform_tenant_id === tenantId;
}
