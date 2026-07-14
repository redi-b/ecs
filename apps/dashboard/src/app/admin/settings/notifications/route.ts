import {
  listMerchantNotificationPreferences,
  sendMerchantNotificationTest,
  upsertMerchantNotificationPreference,
} from "@/lib/merchant-notifications";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { withMerchantAction } from "@/lib/platform-api";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const result = await listMerchantNotificationPreferences({
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

    return {
      ok: true,
      data: { preferences: result.preferences },
      status: 200,
    };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      channel?: unknown;
      enabled?: unknown;
      events?: unknown;
      target?: unknown;
    };

    const action = body.action === "test" ? "test" : "upsert";
    const channel = String(body.channel ?? "").trim().toLowerCase();

    if (!channel) {
      return { ok: false, message: mapPlatformErrorMessage("missing_channel"), status: 400 };
    }

    if (action === "test") {
      const result = await sendMerchantNotificationTest({
        channel,
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

      return {
        ok: true,
        data: {
          ok: true,
          logId: result.logId,
          jobEnqueued: result.jobEnqueued,
        },
        status: 200,
      };
    }

    const target = String(body.target ?? "").trim();
    const enabled = body.enabled !== false;
    const events = Array.isArray(body.events)
      ? body.events.filter((event): event is string => typeof event === "string")
      : [];

    if (!target) {
      return { ok: false, message: mapPlatformErrorMessage("missing_target"), status: 400 };
    }

    const result = await upsertMerchantNotificationPreference({
      channel,
      cookieHeader: context.cookieHeader,
      enabled,
      events,
      platformApiBaseUrl: context.platformApiBaseUrl,
      target,
      tenantId: context.tenantId,
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
      data: { preference: result.preference },
      status: 200,
    };
  });
}
