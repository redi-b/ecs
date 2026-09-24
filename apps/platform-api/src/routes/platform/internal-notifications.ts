import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";

type PlatformInternalNotificationDependencies = Pick<
  PlatformAppOptions,
  "internalApiToken" | "recordNotificationEvent" | "resolveTenantIdByMedusaSalesChannelId"
>;

import { validateNotificationEventPayload } from "../../modules/notifications/event-registry.js";
import { isAllowedNotificationEventType } from "../../modules/notifications/service.js";
import type { NotificationEventType } from "../../types/index.js";

function getInternalToken(request: Request) {
  return request.headers.get("x-platform-internal-token");
}

function readOptionalString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Machine-to-machine notification event ingest (Medusa subscribers, scripts).
 * Auth: PLATFORM_INTERNAL_API_TOKEN via x-platform-internal-token.
 *
 * Body:
 * - eventType (required)
 * - tenantId OR medusaSalesChannelId (one required)
 * - payload (optional)
 * - source / sourceEventId (optional metadata for later idempotency)
 */
export function registerPlatformInternalNotificationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformInternalNotificationDependencies,
) {
  app.post("/platform/internal/notifications/events", async (context) => {
    const expected = options.internalApiToken?.trim();
    if (!expected || getInternalToken(context.req.raw) !== expected) {
      return context.json({ error: "internal_auth_required" }, 401);
    }

    if (!options.recordNotificationEvent) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return context.json({ error: "invalid_notification_event" }, 400);
    }

    const record = body as Record<string, unknown>;
    const eventTypeRaw = readOptionalString(record, "eventType");
    let tenantId = readOptionalString(record, "tenantId");
    const medusaSalesChannelId = readOptionalString(record, "medusaSalesChannelId");

    if (!eventTypeRaw || !isAllowedNotificationEventType(eventTypeRaw)) {
      return context.json({ error: "notification_events_invalid" }, 400);
    }

    if (!tenantId && medusaSalesChannelId) {
      if (!options.resolveTenantIdByMedusaSalesChannelId) {
        return context.json({ error: "tenant_resolution_unavailable" }, 503);
      }
      const resolved = await options.resolveTenantIdByMedusaSalesChannelId(medusaSalesChannelId);
      if (!resolved) {
        return context.json({ error: "tenant_not_found_for_sales_channel" }, 404);
      }
      tenantId = resolved;
    }

    if (!tenantId) {
      return context.json({ error: "tenant_id_required" }, 400);
    }

    const eventType = eventTypeRaw as NotificationEventType;

    const envelope: Record<string, string> = {
      source: readOptionalString(record, "source") || "medusa",
    };
    const sourceEventId = readOptionalString(record, "sourceEventId");
    if (sourceEventId) {
      envelope.sourceEventId = sourceEventId;
    }
    if (medusaSalesChannelId) {
      envelope.medusaSalesChannelId = medusaSalesChannelId;
    }
    const rawPayload = "payload" in record ? record.payload : undefined;
    const payload =
      rawPayload === undefined
        ? envelope
        : typeof rawPayload === "object" && rawPayload !== null && !Array.isArray(rawPayload)
          ? { ...envelope, ...(rawPayload as Record<string, unknown>) }
          : rawPayload;

    const validatedPayload = validateNotificationEventPayload(eventType, payload);
    if (!validatedPayload.ok) {
      return context.json({ error: validatedPayload.error }, 400);
    }

    const result = await options.recordNotificationEvent({
      tenantId,
      eventType,
      payload: validatedPayload.payload,
    });

    return context.json({
      ok: true,
      tenantId,
      logCount: result.logCount,
      logIds: result.logIds,
    });
  });
}
