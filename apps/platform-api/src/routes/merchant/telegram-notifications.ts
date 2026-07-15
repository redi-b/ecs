import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

type AppContext = Context<{ Variables: PlatformAppVariables }>;

function asStatus(status: number): ContentfulStatusCode {
  return status as ContentfulStatusCode;
}

function getOptionalBodyBoolean(body: unknown, key: string) {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}

async function resolveTenantContext(
  context: AppContext,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
  tenantIdParam?: string,
) {
  if (tenantIdParam) {
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) {
      return { ok: false as const, response: context.json({ error: "auth_required" }, 401) };
    }
    const authorization = await options.authorizeDashboardForTenant?.({
      tenantId: tenantIdParam,
      userId: session.user.id,
    });
    if (!authorization?.ok) {
      return { ok: false as const, response: context.json({ error: "dashboard_forbidden" }, 403) };
    }
    return {
      ok: true as const,
      tenantId: tenantIdParam,
      userId: session.user.id,
    };
  }

  const merchant = await helpers.getAuthorizedMerchantContext(context);
  if (!merchant.ok) {
    return { ok: false as const, response: merchant.response };
  }
  return {
    ok: true as const,
    tenantId: merchant.result.context.tenantId,
    userId: merchant.session.user.id,
  };
}

/**
 * Merchant Telegram connect + destination management.
 * Registers both host-scoped and tenant-id-scoped paths.
 */
export function registerMerchantTelegramNotificationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const bases = [
    "/platform/merchant/notifications/telegram",
    "/platform/tenants/:tenantId/notifications/telegram",
  ] as const;

  for (const base of bases) {
    const withTenant = base.includes(":tenantId");

    app.get(`${base}/destinations`, async (context) => {
      if (!options.listTelegramDestinations) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const result = await options.listTelegramDestinations({ tenantId: auth.tenantId });
      return context.json(result);
    });

    app.post(`${base}/connect`, async (context) => {
      if (!options.createTelegramConnectSession) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const result = await options.createTelegramConnectSession({
        tenantId: auth.tenantId,
        userId: auth.userId,
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ session: result.session });
    });

    app.get(`${base}/connect/:sessionId`, async (context) => {
      if (!options.getTelegramConnectSession) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const result = await options.getTelegramConnectSession({
        tenantId: auth.tenantId,
        sessionId: context.req.param("sessionId"),
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ session: result.session });
    });

    app.post(`${base}/connect/:sessionId/cancel`, async (context) => {
      if (!options.cancelTelegramConnectSession) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const result = await options.cancelTelegramConnectSession({
        tenantId: auth.tenantId,
        sessionId: context.req.param("sessionId"),
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ ok: true });
    });

    app.delete(`${base}/destinations/:destinationId`, async (context) => {
      if (!options.removeTelegramDestination) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const result = await options.removeTelegramDestination({
        tenantId: auth.tenantId,
        destinationId: context.req.param("destinationId"),
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ ok: true });
    });

    app.patch(`${base}/destinations/:destinationId`, async (context) => {
      if (!options.setTelegramDestinationEnabled) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const body = await getJsonBody(context.req.raw);
      const enabled = getOptionalBodyBoolean(body, "enabled");
      if (enabled === undefined) {
        return context.json({ error: "invalid_enabled" }, 400);
      }
      const result = await options.setTelegramDestinationEnabled({
        tenantId: auth.tenantId,
        destinationId: context.req.param("destinationId"),
        enabled,
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ destination: result.destination });
    });

    app.post(`${base}/events`, async (context) => {
      if (!options.setTelegramSharedEvents) {
        return context.json({ error: "telegram_not_configured" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const body = await getJsonBody(context.req.raw);
      const rawEvents =
        typeof body === "object" && body !== null && "events" in body
          ? (body as { events?: unknown }).events
          : undefined;
      if (!Array.isArray(rawEvents) || !rawEvents.every((e) => typeof e === "string")) {
        return context.json({ error: "notification_events_invalid" }, 400);
      }
      const result = await options.setTelegramSharedEvents({
        tenantId: auth.tenantId,
        events: rawEvents,
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ events: result.events });
    });

    app.post(`${base}/test`, async (context) => {
      if (!options.sendTestNotification) {
        return context.json({ error: "notifications_unavailable" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) {
        return auth.response;
      }
      const body = await getJsonBody(context.req.raw);
      const destinationId = getRequiredBodyString(body, "destinationId");
      const result = await options.sendTestNotification({
        channel: "telegram",
        tenantId: auth.tenantId,
        ...(destinationId ? { destinationId } : {}),
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({
        ok: true,
        logId: result.logId,
        jobEnqueued: result.jobEnqueued,
      });
    });
  }
}
