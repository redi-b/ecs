import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequestHost, getRequiredBodyString, storeErrorStatus } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";
import { createMerchantDashboardSummary } from "./dashboard-summary.js";

export function registerMerchantDashboardRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext, getResolvedCommerce } = helpers;
  const { getMerchantDashboardPayload } = createMerchantDashboardSummary(
    options,
    getResolvedCommerce,
  );

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

    return context.json(
      await getMerchantDashboardPayload({
        actor: authorization.actor,
        context: result.context,
      }),
    );
  });

  app.get("/platform/merchant/host", async (context) => {
    const host = getRequestHost(
      context.req.header("x-forwarded-host") ?? context.req.header("host"),
    );
    const result = await options.resolveTenantForHost(host);

    if (!result.ok) {
      return context.json({ error: result.error }, storeErrorStatus[result.error]);
    }

    return context.json({
      tenant: {
        id: result.context.tenantId,
        name: result.context.tenantName,
        handle: result.context.tenantHandle,
        hostname: result.context.hostname,
      },
    });
  });

  app.get("/platform/merchant/notifications/preferences", async (context) => {
    if (!options.listNotificationPreferences) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const preferences = await options.listNotificationPreferences({
      tenantId: merchant.result.context.tenantId,
    });

    return context.json({
      preferences: preferences.preferences,
    });
  });

  app.post("/platform/merchant/settings", async (context) => {
    if (!options.updateTenantShopSettings) {
      return context.json({ error: "settings_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    const name = getRequiredBodyString(body, "name");
    const handle = getRequiredBodyString(body, "handle");

    if (!name) {
      return context.json({ error: "missing_name" }, 400);
    }

    if (!handle) {
      return context.json({ error: "missing_handle" }, 400);
    }

    const result = await options.updateTenantShopSettings({
      handle,
      name,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      tenant: result.tenant,
      redirectTo: result.redirectTo,
    });
  });

  app.post("/platform/merchant/notifications/preferences", async (context) => {
    if (!options.upsertNotificationPreference) {
      return context.json({ error: "notifications_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);

    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    const channel = getRequiredBodyString(body, "channel");
    const target = getRequiredBodyString(body, "target");
    const rawEvents =
      typeof body === "object" && body !== null && "events" in body
        ? (body as { events?: unknown }).events
        : undefined;
    const enabled =
      typeof body === "object" &&
      body !== null &&
      "enabled" in body &&
      typeof (body as { enabled?: unknown }).enabled === "boolean"
        ? (body as { enabled: boolean }).enabled
        : true;

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
      enabled,
      events: rawEvents,
      target,
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      preference: result.preference,
    });
  });


}
