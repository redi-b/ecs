import { platformErrorSchema } from "@ecs/contracts";
import {
  createPlatformHeaders,
  getMerchantResourcePath,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

export type InAppNotificationItem = {
  id: string;
  eventType: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type InboxRequestOptions = {
  cookieHeader?: string | null;
  platformApiBaseUrl: string;
  /** Shop host for host-scoped merchant APIs (required when tenantId is omitted). */
  requestHost?: string | null;
  tenantId?: string | null;
};

function inboxUrl(
  platformApiBaseUrl: string,
  tenantId: string | null | undefined,
  suffix = "",
) {
  const path = getMerchantResourcePath("notifications", {
    tenantId,
    suffix: `inbox${suffix ? `/${suffix.replace(/^\//, "")}` : ""}`.replace(/\/+/g, "/"),
  });
  return new URL(path.replace(/^\//, ""), normalizeBaseUrl(platformApiBaseUrl));
}

function platformHeaders(options: InboxRequestOptions) {
  return createPlatformHeaders({
    contentType: "json",
    cookieHeader: options.cookieHeader,
    requestHost: options.requestHost,
  });
}

async function parseError(response: Response, data: unknown) {
  const error = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    status: response.status,
    message: error.success ? error.data.error : "notifications_unavailable",
  };
}

export async function listInAppNotifications(
  options: InboxRequestOptions & { unreadOnly?: boolean },
): Promise<
  | { ok: true; items: InAppNotificationItem[] }
  | { ok: false; message: string; status: number }
> {
  const url = inboxUrl(options.platformApiBaseUrl, options.tenantId);
  if (options.unreadOnly) {
    url.searchParams.set("unreadOnly", "true");
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: platformHeaders(options),
  }).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    return parseError(response, data);
  }
  const items = Array.isArray((data as { items?: unknown })?.items)
    ? ((data as { items: InAppNotificationItem[] }).items ?? [])
    : [];
  return { ok: true, items };
}

export async function countInAppNotificationUnread(
  options: InboxRequestOptions,
): Promise<{ ok: true; count: number } | { ok: false; message: string; status: number }> {
  const response = await fetch(
    inboxUrl(options.platformApiBaseUrl, options.tenantId, "unread-count"),
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
  const count = typeof (data as { count?: unknown })?.count === "number" ? data.count : 0;
  return { ok: true, count };
}

export async function markInAppNotificationRead(
  options: InboxRequestOptions & { id: string },
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const response = await fetch(
    inboxUrl(options.platformApiBaseUrl, options.tenantId, `${options.id}/read`),
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

export async function markAllInAppNotificationsRead(
  options: InboxRequestOptions,
): Promise<{ ok: true; updated: number } | { ok: false; message: string; status: number }> {
  const response = await fetch(
    inboxUrl(options.platformApiBaseUrl, options.tenantId, "read-all"),
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
  const updated = typeof (data as { updated?: unknown })?.updated === "number" ? data.updated : 0;
  return { ok: true, updated };
}
