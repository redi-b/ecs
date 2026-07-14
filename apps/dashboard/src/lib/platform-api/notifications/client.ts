import { platformErrorSchema } from "@ecs/contracts";
import {
  createPlatformHeaders,
  getMerchantResourcePath,
  normalizeBaseUrl,
} from "@/lib/platform-api/client";

export type NotificationPreference = {
  id: string;
  channel: string;
  enabled: boolean;
  events: string[];
  target: string;
  updatedAt: string;
};

export type NotificationPreferencesResult =
  | { ok: true; preferences: NotificationPreference[] }
  | { ok: false; message: string; status: number };

export type NotificationPreferenceUpsertResult =
  | { ok: true; preference: NotificationPreference }
  | { ok: false; message: string; status: number };

export type NotificationTestResult =
  | { ok: true; logId: string; jobEnqueued: boolean }
  | { ok: false; message: string; status: number };

function notificationsPath(
  tenantId: string | null | undefined,
  kind: "preferences" | "test",
) {
  return getMerchantResourcePath("notifications", {
    tenantId,
    suffix: kind,
  });
}

function notificationsUrl(
  platformApiBaseUrl: string,
  tenantId: string | null | undefined,
  kind: "preferences" | "test",
) {
  return new URL(
    notificationsPath(tenantId, kind).replace(/^\//, ""),
    normalizeBaseUrl(platformApiBaseUrl),
  );
}

export async function listMerchantNotificationPreferences(options: {
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}): Promise<NotificationPreferencesResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    notificationsUrl(options.platformApiBaseUrl, options.tenantId, "preferences"),
    {
      cache: "no-store",
      headers: createPlatformHeaders({
        contentType: "json",
        cookieHeader: options.cookieHeader,
      }),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : "notifications_unavailable",
    };
  }

  const preferences = Array.isArray((data as { preferences?: unknown })?.preferences)
    ? ((data as { preferences: NotificationPreference[] }).preferences ?? [])
    : [];

  return { ok: true, preferences };
}

export async function upsertMerchantNotificationPreference(options: {
  channel: string;
  cookieHeader?: string | null | undefined;
  enabled: boolean;
  events: string[];
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  target: string;
  tenantId?: string | null | undefined;
}): Promise<NotificationPreferenceUpsertResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    notificationsUrl(options.platformApiBaseUrl, options.tenantId, "preferences"),
    {
      method: "POST",
      cache: "no-store",
      headers: createPlatformHeaders({
        contentType: "json",
        cookieHeader: options.cookieHeader,
      }),
      body: JSON.stringify({
        channel: options.channel,
        enabled: options.enabled,
        events: options.events,
        target: options.target,
      }),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : "notifications_unavailable",
    };
  }

  const preference = (data as { preference?: NotificationPreference })?.preference;
  if (!preference?.id) {
    return { ok: false, status: 502, message: "invalid_notification_response" };
  }

  return { ok: true, preference };
}

export async function sendMerchantNotificationTest(options: {
  channel: string;
  cookieHeader?: string | null | undefined;
  fetcher?: typeof fetch;
  platformApiBaseUrl: string;
  tenantId?: string | null | undefined;
}): Promise<NotificationTestResult> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(
    notificationsUrl(options.platformApiBaseUrl, options.tenantId, "test"),
    {
      method: "POST",
      cache: "no-store",
      headers: createPlatformHeaders({
        contentType: "json",
        cookieHeader: options.cookieHeader,
      }),
      body: JSON.stringify({ channel: options.channel }),
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 503, message: "platform_request_failed" };
  }

  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      status: response.status,
      message: error.success ? error.data.error : "notifications_unavailable",
    };
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
