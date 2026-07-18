import {
  cancelTelegramOperatorLinkSession,
  createTelegramOperatorLinkSession,
  getTelegramOperatorLinkSession,
  listTelegramOperatorBindings,
  removeTelegramOperatorBinding,
  setTelegramOperatorBindingEnabled,
} from "@/lib/platform-api/notifications/telegram-client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { withMerchantAction } from "@/lib/platform-api";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    };

    if (sessionId) {
      const result = await getTelegramOperatorLinkSession({
        ...common,
        sessionId,
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

    const result = await listTelegramOperatorBindings(common);
    if (!result.ok) {
      return {
        ok: false,
        message: mapPlatformErrorMessage(result.message),
        status: result.status,
      };
    }
    return { ok: true, data: { bindings: result.bindings }, status: 200 };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      bindingId?: unknown;
      enabled?: unknown;
      sessionId?: unknown;
    };
    const action = String(body.action ?? "").trim();
    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    };

    if (action === "link") {
      const result = await createTelegramOperatorLinkSession(common);
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
      const result = await cancelTelegramOperatorLinkSession({ ...common, sessionId });
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
      const bindingId = String(body.bindingId ?? "").trim();
      if (!bindingId) {
        return { ok: false, message: "binding_not_found", status: 400 };
      }
      const result = await removeTelegramOperatorBinding({ ...common, bindingId });
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
      const bindingId = String(body.bindingId ?? "").trim();
      if (!bindingId || typeof body.enabled !== "boolean") {
        return { ok: false, message: "invalid_enabled", status: 400 };
      }
      const result = await setTelegramOperatorBindingEnabled({
        ...common,
        bindingId,
        enabled: body.enabled,
      });
      if (!result.ok) {
        return {
          ok: false,
          message: mapPlatformErrorMessage(result.message),
          status: result.status,
        };
      }
      return { ok: true, data: { binding: result.binding }, status: 200 };
    }

    return { ok: false, message: "invalid_action", status: 400 };
  });
}
