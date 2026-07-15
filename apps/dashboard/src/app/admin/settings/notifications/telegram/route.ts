import {
  cancelTelegramConnectSession,
  createTelegramConnectSession,
  getTelegramConnectSession,
  listTelegramDestinations,
  removeTelegramDestination,
  sendTelegramTest,
  setTelegramDestinationEnabled,
  setTelegramSharedEvents,
} from "@/lib/platform-api/notifications/telegram-client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { withMerchantAction } from "@/lib/platform-api";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (sessionId) {
      const result = await getTelegramConnectSession({
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        sessionId,
        tenantId: context.tenantId,
      });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { session: result.session }, status: 200 };
    }

    const result = await listTelegramDestinations({
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
    return { ok: true, data: { destinations: result.destinations }, status: 200 };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      destinationId?: unknown;
      enabled?: unknown;
      events?: unknown;
      sessionId?: unknown;
    };
    const action = String(body.action ?? "").trim();
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      tenantId: context.tenantId,
    };

    if (action === "connect") {
      const result = await createTelegramConnectSession(common);
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { session: result.session }, status: 200 };
    }

    if (action === "cancel") {
      const sessionId = String(body.sessionId ?? "").trim();
      if (!sessionId) {
        return { ok: false, message: "session_not_found", status: 400 };
      }
      const result = await cancelTelegramConnectSession({ ...common, sessionId });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { ok: true }, status: 200 };
    }

    if (action === "remove") {
      const destinationId = String(body.destinationId ?? "").trim();
      if (!destinationId) {
        return { ok: false, message: "destination_not_found", status: 400 };
      }
      const result = await removeTelegramDestination({ ...common, destinationId });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { ok: true }, status: 200 };
    }

    if (action === "enable") {
      const destinationId = String(body.destinationId ?? "").trim();
      if (!destinationId || typeof body.enabled !== "boolean") {
        return { ok: false, message: "invalid_enabled", status: 400 };
      }
      const result = await setTelegramDestinationEnabled({
        ...common,
        destinationId,
        enabled: body.enabled,
      });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { destination: result.destination }, status: 200 };
    }

    if (action === "events") {
      const events = Array.isArray(body.events)
        ? body.events.filter((e): e is string => typeof e === "string")
        : [];
      const result = await setTelegramSharedEvents({ ...common, events });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { events: result.events }, status: 200 };
    }

    if (action === "test") {
      const destinationId = String(body.destinationId ?? "").trim();
      if (!destinationId) {
        return {
          ok: false,
          message: mapPlatformErrorMessage("notification_preference_missing"),
          status: 400,
        };
      }
      const result = await sendTelegramTest({ ...common, destinationId });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return {
        ok: true,
        data: { ok: true, logId: result.logId, jobEnqueued: result.jobEnqueued },
        status: 200,
      };
    }

    return { ok: false, message: "invalid_action", status: 400 };
  });
}
