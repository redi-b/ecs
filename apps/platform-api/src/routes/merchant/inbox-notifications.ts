import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import type { MerchantRouteHelpers } from "./context.js";

type AppContext = Context<{ Variables: PlatformAppVariables }>;

function asStatus(status: number): ContentfulStatusCode {
  return status as ContentfulStatusCode;
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
      permission: { notifications: ["read"] },
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

  const merchant = await helpers.getAuthorizedMerchantContext(context, {
    notifications: ["read"],
  });
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
 * Merchant in-app notification inbox (bell feed).
 */
export function registerMerchantInboxNotificationRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const bases = [
    "/platform/merchant/notifications/inbox",
    "/platform/tenants/:tenantId/notifications/inbox",
  ] as const;

  for (const base of bases) {
    const withTenant = base.includes(":tenantId");

    app.get(base, async (context) => {
      if (!options.listInAppNotifications) {
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

      const unreadOnly = context.req.query("unreadOnly") === "true";
      const categoryValue = context.req.query("category");
      const category = isInboxCategory(categoryValue) ? categoryValue : undefined;
      const cursor = context.req.query("cursor")?.trim() || undefined;
      const q = context.req.query("q")?.trim() || undefined;
      const requestedLimit = Number(context.req.query("limit"));
      const requestedOffset = Number(context.req.query("offset"));
      const result = await options.listInAppNotifications({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        ...(category ? { category } : {}),
        ...(cursor ? { cursor } : {}),
        ...(Number.isInteger(requestedLimit) ? { limit: requestedLimit } : {}),
        ...(Number.isInteger(requestedOffset) ? { offset: requestedOffset } : {}),
        ...(q ? { q } : {}),
        unreadOnly,
      });
      return context.json(result);
    });

    app.get(`${base}/unread-count`, async (context) => {
      if (!options.countInAppNotificationUnread) {
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

      const result = await options.countInAppNotificationUnread({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
      });
      return context.json(result);
    });

    app.post(`${base}/read-all`, async (context) => {
      if (!options.markAllInAppNotificationsRead) {
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

      const result = await options.markAllInAppNotificationsRead({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
      });
      return context.json(result);
    });

    app.post(`${base}/seen`, async (context) => {
      if (!options.markInAppNotificationsSeen) {
        return context.json({ error: "notifications_unavailable" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) return auth.response;
      const body = (await context.req.json().catch(() => ({}))) as { ids?: unknown };
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        : [];
      const result = await options.markInAppNotificationsSeen({
        actorUserId: auth.userId,
        ids,
        tenantId: auth.tenantId,
      });
      return context.json(result);
    });

    app.post(`${base}/:id/read`, async (context) => {
      if (!options.markInAppNotificationRead) {
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

      const id = context.req.param("id");
      if (!id?.trim()) {
        return context.json({ error: "not_found" }, 404);
      }

      const result = await options.markInAppNotificationRead({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        id: id.trim(),
        read: true,
      });
      if (!result.ok) {
        return context.json({ error: result.error }, asStatus(result.status));
      }
      return context.json({ ok: true });
    });

    app.post(`${base}/:id/unread`, async (context) => {
      if (!options.markInAppNotificationRead) {
        return context.json({ error: "notifications_unavailable" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) return auth.response;
      const result = await options.markInAppNotificationRead({
        actorUserId: auth.userId,
        id: context.req.param("id"),
        read: false,
        tenantId: auth.tenantId,
      });
      return result.ok
        ? context.json({ ok: true })
        : context.json({ error: result.error }, asStatus(result.status));
    });

    app.post(`${base}/:id/archive`, async (context) => {
      if (!options.archiveInAppNotification) {
        return context.json({ error: "notifications_unavailable" }, 503);
      }
      const auth = await resolveTenantContext(
        context,
        options,
        helpers,
        withTenant ? context.req.param("tenantId") : undefined,
      );
      if (!auth.ok) return auth.response;
      const result = await options.archiveInAppNotification({
        actorUserId: auth.userId,
        id: context.req.param("id"),
        tenantId: auth.tenantId,
      });
      return result.ok
        ? context.json({ ok: true })
        : context.json({ error: result.error }, asStatus(result.status));
    });
  }
}

function isInboxCategory(
  value: string | undefined,
): value is "billing" | "inquiries" | "inventory" | "orders" | "system" {
  return ["billing", "inquiries", "inventory", "orders", "system"].includes(value ?? "");
}
