import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

export type AccountSession = {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  isCurrent: boolean;
  token: string;
  updatedAt: string;
  userAgent: string | null;
};

export type AuthRequestContext = {
  cookieHeader?: string | null | undefined;
  /** Full origin of the dashboard request, e.g. http://bole-style.lvh.me:3001 */
  origin?: string | null | undefined;
  platformApiBaseUrl?: string | null | undefined;
  requestHost?: string | null | undefined;
  requestProto?: string | null | undefined;
};

function authUrl(path: string, baseUrl?: string | null) {
  return new URL(path, getPlatformApiBaseUrl(baseUrl));
}

function resolveOrigin(options: AuthRequestContext) {
  if (options.origin?.trim()) return options.origin.trim().replace(/\/$/, "");
  const host = options.requestHost?.trim();
  if (!host) return null;
  const proto = options.requestProto?.trim() || "http";
  return `${proto}://${host}`;
}

function authHeaders(options: AuthRequestContext & { json?: boolean | undefined }) {
  const headers = new Headers();
  if (options.json) {
    headers.set("accept", "application/json");
    headers.set("content-type", "application/json");
  } else {
    headers.set("accept", "application/json");
  }
  if (options.cookieHeader?.trim()) {
    headers.set("cookie", options.cookieHeader.trim());
  }

  const origin = resolveOrigin(options);
  if (origin) {
    // better-auth CSRF/origin middleware requires a trusted Origin on mutating requests.
    headers.set("origin", origin);
    headers.set("referer", `${origin}/`);
  }

  if (options.requestHost?.trim()) {
    headers.set("x-forwarded-host", options.requestHost.trim());
  }
  if (options.requestProto?.trim()) {
    headers.set("x-forwarded-proto", options.requestProto.trim());
  }

  return headers;
}

export async function changeAccountPassword(
  options: AuthRequestContext & {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean | undefined;
  },
) {
  const response = await fetch(authUrl("/platform/auth/change-password", options.platformApiBaseUrl), {
    body: JSON.stringify({
      currentPassword: options.currentPassword,
      newPassword: options.newPassword,
      revokeOtherSessions: options.revokeOtherSessions ?? true,
    }),
    headers: authHeaders({ ...options, json: true }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return { ok: false as const, message: "auth_unavailable", status: 503, cookies: [] as string[] };
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    return {
      ok: false as const,
      message: data?.code || data?.message || "password_change_failed",
      status: response.status,
      cookies: [] as string[],
    };
  }

  // better-auth deletes all sessions and issues a new one when revokeOtherSessions is true.
  // Forward Set-Cookie so the browser keeps the replacement session.
  return { ok: true as const, cookies: getSetCookieValues(response.headers) };
}

function getSetCookieValues(headers: Headers) {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = headersWithSetCookie.getSetCookie?.();
  if (cookies?.length) return cookies;
  const cookie = headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

export async function updateAccountProfile(
  options: AuthRequestContext & {
    name: string;
  },
) {
  const response = await fetch(authUrl("/platform/auth/update-user", options.platformApiBaseUrl), {
    body: JSON.stringify({ name: options.name.trim() }),
    headers: authHeaders({ ...options, json: true }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return { ok: false as const, message: "auth_unavailable", status: 503 };
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    return {
      ok: false as const,
      message: data?.code || data?.message || "profile_update_failed",
      status: response.status,
    };
  }

  return { ok: true as const };
}

export async function listAccountSessions(options: AuthRequestContext) {
  const response = await fetch(authUrl("/platform/auth/list-sessions", options.platformApiBaseUrl), {
    headers: authHeaders(options),
    method: "GET",
  }).catch(() => null);

  if (!response) {
    return {
      ok: false as const,
      message: "auth_unavailable",
      status: 503,
      sessions: [] as AccountSession[],
    };
  }

  if (!response.ok) {
    return {
      ok: false as const,
      message: "sessions_unavailable",
      status: response.status,
      sessions: [] as AccountSession[],
    };
  }

  const data = (await response.json().catch(() => null)) as unknown;
  const rows = Array.isArray(data) ? data : [];
  const sessions: AccountSession[] = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : null;
    const token = typeof item.token === "string" ? item.token : null;
    if (!id || !token) return [];
    return [
      {
        id,
        token,
        createdAt: toIso(item.createdAt),
        updatedAt: toIso(item.updatedAt),
        expiresAt: toIso(item.expiresAt),
        ipAddress: typeof item.ipAddress === "string" ? item.ipAddress : null,
        userAgent: typeof item.userAgent === "string" ? item.userAgent : null,
        isCurrent: false,
      },
    ];
  });

  return { ok: true as const, sessions };
}

export async function revokeAccountSession(
  options: AuthRequestContext & {
    token: string;
  },
) {
  const response = await fetch(authUrl("/platform/auth/revoke-session", options.platformApiBaseUrl), {
    body: JSON.stringify({ token: options.token }),
    headers: authHeaders({ ...options, json: true }),
    method: "POST",
  }).catch(() => null);

  if (!response) {
    return { ok: false as const, message: "auth_unavailable", status: 503 };
  }

  if (!response.ok) {
    return { ok: false as const, message: "session_revoke_failed", status: response.status };
  }

  return { ok: true as const };
}

function toIso(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}
