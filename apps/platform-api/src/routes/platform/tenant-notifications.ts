import type { Hono } from "hono";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";
import { getOptionalBodyBoolean } from "./helpers.js";

type Dependencies = Pick<
  PlatformAppOptions,
  | "authorizeDashboardForTenant"
  | "getSession"
  | "listNotificationPreferences"
  | "sendTestNotification"
  | "upsertNotificationPreference"
>;

export function registerPlatformTenantNotificationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: Dependencies,
) {
  app.get("/platform/tenants/:tenantId/notifications/preferences", async (context) => {
    if (!options.listNotificationPreferences) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { notifications: ["read"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const result = await options.listNotificationPreferences({ tenantId });

    return context.json({
      preferences: result.preferences,
    });
  });

  app.post("/platform/tenants/:tenantId/notifications/preferences", async (context) => {
    if (!options.upsertNotificationPreference) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { notifications: ["manage"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const channel = getRequiredBodyString(body, "channel");
    const target = getRequiredBodyString(body, "target");
    const rawEvents =
      typeof body === "object" && body !== null && "events" in body
        ? (body as { events?: unknown }).events
        : undefined;

    if (!channel) {
      return context.json({ error: "missing_channel" }, 400);
    }

    if (!target) {
      return context.json({ error: "missing_target" }, 400);
    }

    if (!Array.isArray(rawEvents) || !rawEvents.every((event) => typeof event === "string")) {
      return context.json({ error: "notification_events_invalid" }, 400);
    }

    const result = await options.upsertNotificationPreference({
      channel,
      enabled: getOptionalBodyBoolean(body, "enabled", true),
      events: rawEvents,
      target,
      tenantId,
      userId: session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      preference: result.preference,
    });
  });

  app.post("/platform/tenants/:tenantId/notifications/test", async (context) => {
    if (!options.sendTestNotification) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const session = await options.getSession?.(context.req.raw.headers);

    if (!session) {
      return context.json({ error: "auth_required" }, 401);
    }

    const tenantId = context.req.param("tenantId");
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId,
      userId: session.user.id,
      permission: { notifications: ["manage"] },
    });

    if (!authorization?.ok) {
      return context.json({ error: "dashboard_forbidden" }, 403);
    }

    const body = await getJsonBody(context.req.raw);
    const channel = getRequiredBodyString(body, "channel");

    if (!channel) {
      return context.json({ error: "missing_channel" }, 400);
    }

    const result = await options.sendTestNotification({
      channel,
      tenantId,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      ok: true,
      logId: result.logId,
      jobEnqueued: result.jobEnqueued,
    });
  });
}
