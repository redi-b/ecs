import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { isAllowedNotificationEventType } from "../../modules/notifications/service.js";
import type { NotificationEventType } from "../../types/index.js";

function getInternalToken(request: Request) {
  return request.headers.get("x-platform-internal-token");
}

/**
 * Machine-to-machine notification event ingest (future Medusa subscribers, scripts).
 * Auth: PLATFORM_INTERNAL_API_TOKEN via x-platform-internal-token.
 */
export function registerPlatformInternalNotificationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
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
    const tenantId =
      typeof record.tenantId === "string" ? record.tenantId.trim() : "";
    const eventTypeRaw =
      typeof record.eventType === "string" ? record.eventType.trim() : "";

    if (!tenantId) {
      return context.json({ error: "tenant_id_required" }, 400);
    }

    if (!eventTypeRaw || !isAllowedNotificationEventType(eventTypeRaw)) {
      return context.json({ error: "notification_events_invalid" }, 400);
    }

    const eventType = eventTypeRaw as NotificationEventType;
    const payload = "payload" in record ? record.payload : undefined;

    const result = await options.recordNotificationEvent({
      tenantId,
      eventType,
      ...(payload !== undefined ? { payload } : {}),
    });

    return context.json({
      ok: true,
      logCount: result.logCount,
      logIds: result.logIds,
    });
  });
}
