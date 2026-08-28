import { platformErrorSchema, superadminSupportAccessSchema } from "@ecs/contracts";

import { platformFetch } from "../client";

type Common = { cookieHeader?: string | null; platformApiBaseUrl?: string; tenantId: string };

export async function getSuperadminSupportAccess(options: Common) {
  const response = await request(options, "GET");
  const data = await response.json().catch(() => undefined);
  if (!response.ok) return errorResult(response, data);
  const parsed = superadminSupportAccessSchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, grants: parsed.data.grants }
    : { ok: false as const, message: "invalid_support_access", status: 502 };
}

export async function createSuperadminSupportAccess(
  options: Common & { expiresAt: string; reason: string },
) {
  const response = await request(options, "POST", {
    expiresAt: options.expiresAt,
    reason: options.reason,
  });
  const data = await response.json().catch(() => undefined);
  return response.ok ? { ok: true as const } : errorResult(response, data);
}

export async function revokeSuperadminSupportAccess(
  options: Common & { grantId: string; reason: string },
) {
  const response = await request(options, "DELETE", { reason: options.reason }, options.grantId);
  const data = await response.json().catch(() => undefined);
  return response.ok ? { ok: true as const } : errorResult(response, data);
}

function request(options: Common, method: "GET" | "POST" | "DELETE", body?: unknown, id?: string) {
  return platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/support-access${id ? `/${encodeURIComponent(id)}` : ""}`,
    {
      ...(body === undefined ? {} : { body: JSON.stringify(body), contentType: "json" as const }),
      cookieHeader: options.cookieHeader,
      method,
      ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    },
  );
}

function errorResult(response: Response, data: unknown) {
  const parsed = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    message: parsed.success ? parsed.data.error : "support_access_request_failed",
    status: response.status,
  };
}
