import { platformErrorSchema } from "@ecs/contracts";
import {
  createPlatformHeaders,
  getMerchantResourcePath,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

type PlatformCallOptions = {
  cookieHeader?: string | null;
  platformApiBaseUrl: string;
  requestHost?: string | null;
  tenantId?: string | null;
};

function platformHeaders(options: Pick<PlatformCallOptions, "cookieHeader" | "requestHost">) {
  return createPlatformHeaders({
    contentType: "json",
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}

export type TelegramDestination = {
  id: string;
  label: string;
  username: string | null;
  enabled: boolean;
  events: string[];
  connectedAt: string;
};

export type TelegramConnectSession = {
  id: string;
  status: string;
  expiresAt: string;
  deepLink: string | null;
};

function telegramUrl(
  platformApiBaseUrl: string,
  tenantId: string | null | undefined,
  suffix: string,
) {
  const path = getMerchantResourcePath("notifications", {
    tenantId,
    suffix: `telegram/${suffix}`.replace(/\/+/g, "/"),
  });
  return new URL(path.replace(/^\//, ""), normalizeBaseUrl(platformApiBaseUrl));
}

async function parseError(response: Response, data: unknown) {
  const error = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    status: response.status,
    message: error.success ? error.data.error : "telegram_not_configured",
  };
}

export async function listTelegramDestinations(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  platformApiBaseUrl: string;
  tenantId?: string | null;
}): Promise<
  | { ok: true; destinations: TelegramDestination[] }
  | { ok: false; message: string; status: number }
> {
  const response = await fetch(
    telegramUrl(options.platformApiBaseUrl, options.tenantId, "destinations"),
    {
      cache: "no-store",
      headers: platformHeaders(options),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const destinations = Array.isArray((data as { destinations?: unknown })?.destinations)
    ? ((data as { destinations: TelegramDestination[] }).destinations ?? [])
    : [];
  return { ok: true, destinations };
}

export async function createTelegramConnectSession(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  platformApiBaseUrl: string;
  tenantId?: string | null;
}): Promise<
  | { ok: true; session: TelegramConnectSession & { deepLink: string } }
  | { ok: false; message: string; status: number }
> {
  const response = await fetch(
    telegramUrl(options.platformApiBaseUrl, options.tenantId, "connect"),
    {
      method: "POST",
      cache: "no-store",
      headers: platformHeaders(options),
      body: "{}",
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const session = (data as { session?: TelegramConnectSession & { deepLink: string } })?.session;
  if (!session?.id || !session.deepLink) {
    return { ok: false, status: 502, message: "invalid_telegram_session" };
  }
  return { ok: true, session };
}

export async function getTelegramConnectSession(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  platformApiBaseUrl: string;
  sessionId: string;
  tenantId?: string | null;
}): Promise<
  | { ok: true; session: TelegramConnectSession }
  | { ok: false; message: string; status: number }
> {
  const response = await fetch(
    telegramUrl(options.platformApiBaseUrl, options.tenantId, `connect/${options.sessionId}`),
    {
      cache: "no-store",
      headers: platformHeaders(options),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const session = (data as { session?: TelegramConnectSession })?.session;
  if (!session?.id) {
    return { ok: false, status: 502, message: "invalid_telegram_session" };
  }
  return { ok: true, session };
}

export async function cancelTelegramConnectSession(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  platformApiBaseUrl: string;
  sessionId: string;
  tenantId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const response = await fetch(
    telegramUrl(
      options.platformApiBaseUrl,
      options.tenantId,
      `connect/${options.sessionId}/cancel`,
    ),
    {
      method: "POST",
      cache: "no-store",
      headers: platformHeaders(options),
      body: "{}",
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    return parseError(response, data);
  }
  return { ok: true };
}

export async function removeTelegramDestination(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  destinationId: string;
  platformApiBaseUrl: string;
  tenantId?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const response = await fetch(
    telegramUrl(
      options.platformApiBaseUrl,
      options.tenantId,
      `destinations/${options.destinationId}`,
    ),
    {
      method: "DELETE",
      cache: "no-store",
      headers: platformHeaders(options),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  if (!response.ok) {
    const data = await response.json().catch(() => undefined);
    return parseError(response, data);
  }
  return { ok: true };
}

export async function setTelegramDestinationEnabled(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  destinationId: string;
  enabled: boolean;
  platformApiBaseUrl: string;
  tenantId?: string | null;
}): Promise<
  | { ok: true; destination: TelegramDestination }
  | { ok: false; message: string; status: number }
> {
  const response = await fetch(
    telegramUrl(
      options.platformApiBaseUrl,
      options.tenantId,
      `destinations/${options.destinationId}`,
    ),
    {
      method: "PATCH",
      cache: "no-store",
      headers: platformHeaders(options),
      body: JSON.stringify({ enabled: options.enabled }),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const destination = (data as { destination?: TelegramDestination })?.destination;
  if (!destination?.id) {
    return { ok: false, status: 502, message: "invalid_telegram_destination" };
  }
  return { ok: true, destination };
}

export async function setTelegramSharedEvents(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  events: string[];
  platformApiBaseUrl: string;
  tenantId?: string | null;
}): Promise<
  | { ok: true; events: string[] }
  | { ok: false; message: string; status: number }
> {
  const response = await fetch(
    telegramUrl(options.platformApiBaseUrl, options.tenantId, "events"),
    {
      method: "POST",
      cache: "no-store",
      headers: platformHeaders(options),
      body: JSON.stringify({ events: options.events }),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const events = Array.isArray((data as { events?: unknown })?.events)
    ? ((data as { events: string[] }).events ?? [])
    : options.events;
  return { ok: true, events };
}

export async function sendTelegramTest(options: {
  cookieHeader?: string | null;
  requestHost?: string | null;
  destinationId: string;
  platformApiBaseUrl: string;
  tenantId?: string | null;
}): Promise<
  | { ok: true; logId: string; jobEnqueued: boolean }
  | { ok: false; message: string; status: number }
> {
  const response = await fetch(
    telegramUrl(options.platformApiBaseUrl, options.tenantId, "test"),
    {
      method: "POST",
      cache: "no-store",
      headers: platformHeaders(options),
      body: JSON.stringify({ destinationId: options.destinationId }),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const logId = (data as { logId?: string })?.logId;
  if (!logId) {
    return { ok: false, status: 502, message: "invalid_notification_response" };
  }
  return {
    ok: true,
    logId,
    jobEnqueued: (data as { jobEnqueued?: boolean })?.jobEnqueued === true,
  };
}
