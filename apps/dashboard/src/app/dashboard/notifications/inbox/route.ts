import { withMerchantAction } from "@/lib/platform-api";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import {
  archiveInAppNotification,
  countInAppNotificationUnread,
  listInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
  markInAppNotificationsSeen,
} from "@/lib/platform-api/notifications/inbox-client";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const countOnly = url.searchParams.get("countOnly") === "true";
    const categoryValue = url.searchParams.get("category");
    const category = isInboxCategory(categoryValue) ? categoryValue : undefined;
    const cursor = url.searchParams.get("cursor")?.trim() || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;
    const limitValue = Number(url.searchParams.get("limit"));
    const offsetValue = Number(url.searchParams.get("offset"));
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    };

    if (countOnly) {
      const result = await countInAppNotificationUnread(common);
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { count: result.count }, status: 200 };
    }

    const result = await listInAppNotifications({
      ...common,
      ...(category ? { category } : {}),
      ...(cursor ? { cursor } : {}),
      ...(Number.isInteger(limitValue) ? { limit: limitValue } : {}),
      ...(Number.isInteger(offsetValue) ? { offset: offsetValue } : {}),
      ...(q ? { q } : {}),
      unreadOnly,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: mapPlatformErrorMessage(result.message),
        status: result.status,
      };
    }
    return {
      ok: true,
      data: { count: result.count, items: result.items, nextCursor: result.nextCursor },
      status: 200,
    };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      id?: unknown;
      ids?: unknown;
    };
    const action = typeof body.action === "string" ? body.action : "";
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    };

    if (action === "read-all") {
      const result = await markAllInAppNotificationsRead(common);
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { ok: true, updated: result.updated }, status: 200 };
    }

    if (action === "seen") {
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        : [];
      const result = await markInAppNotificationsSeen({ ...common, ids });
      return result.ok
        ? { data: { ok: true, updated: result.updated }, ok: true, status: 200 }
        : {
            message: mapPlatformErrorMessage(result.message),
            ok: false,
            status: result.status,
          };
    }

    if (action === "read" || action === "unread") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) {
        return { ok: false, message: mapPlatformErrorMessage("not_found"), status: 404 };
      }
      const result = await markInAppNotificationRead({
        ...common,
        id,
        read: action === "read",
      });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { ok: true }, status: 200 };
    }

    if (action === "archive") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) return { ok: false, message: mapPlatformErrorMessage("not_found"), status: 404 };
      const result = await archiveInAppNotification({ ...common, id });
      return result.ok
        ? { data: { ok: true }, ok: true, status: 200 }
        : {
            message: mapPlatformErrorMessage(result.message),
            ok: false,
            status: result.status,
          };
    }

    return { ok: false, message: "invalid_action", status: 400 };
  });
}

function isInboxCategory(
  value: string | null,
): value is "billing" | "inquiries" | "inventory" | "orders" | "system" {
  return ["billing", "inquiries", "inventory", "orders", "system"].includes(value ?? "");
}
