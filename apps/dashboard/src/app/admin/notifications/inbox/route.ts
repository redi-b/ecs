import {
  countInAppNotificationUnread,
  listInAppNotifications,
  markAllInAppNotificationsRead,
  markInAppNotificationRead,
} from "@/lib/platform-api/notifications/inbox-client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { withMerchantAction } from "@/lib/platform-api";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";
    const countOnly = url.searchParams.get("countOnly") === "true";

    if (countOnly) {
      const result = await countInAppNotificationUnread({
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        tenantId: context.tenantId,
      });
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
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      tenantId: context.tenantId,
      unreadOnly,
    });
    if (!result.ok) {
      return {
        ok: false,
        message: mapPlatformErrorMessage(result.message),
        status: result.status,
      };
    }
    return { ok: true, data: { items: result.items }, status: 200 };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      id?: unknown;
    };
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "read-all") {
      const result = await markAllInAppNotificationsRead({
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        tenantId: context.tenantId,
      });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { ok: true, updated: result.updated }, status: 200 };
    }

    if (action === "read") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      if (!id) {
        return { ok: false, message: mapPlatformErrorMessage("not_found"), status: 404 };
      }
      const result = await markInAppNotificationRead({
        cookieHeader: context.cookieHeader,
        id,
        platformApiBaseUrl: context.platformApiBaseUrl,
        tenantId: context.tenantId,
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

    return { ok: false, message: "invalid_action", status: 400 };
  });
}
