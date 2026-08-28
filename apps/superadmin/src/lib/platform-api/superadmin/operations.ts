import { platformErrorSchema, superadminOperationalSummarySchema } from "@ecs/contracts";

import { platformFetch } from "../client";

export async function getSuperadminOperationalSummary(options: {
  cookieHeader?: string | null;
  platformApiBaseUrl?: string;
  tenantId: string;
}) {
  const response = await platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/operations`,
    {
      cookieHeader: options.cookieHeader,
      ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    },
  );
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false as const,
      message: error.success ? error.data.error : "operations_unavailable",
      status: response.status,
    };
  }
  const parsed = superadminOperationalSummarySchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, summary: parsed.data }
    : { ok: false as const, message: "invalid_operations_response", status: 502 };
}

export async function updateSuperadminTenantStatus(options: {
  cookieHeader?: string | null;
  platformApiBaseUrl?: string;
  reason: string;
  status: "active" | "suspended";
  tenantId: string;
}) {
  const response = await platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/status`,
    {
      body: JSON.stringify({ reason: options.reason, status: options.status }),
      contentType: "json",
      cookieHeader: options.cookieHeader,
      method: "POST",
      ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    },
  );
  const data = await response.json().catch(() => undefined);
  if (response.ok) return { ok: true as const };
  const error = platformErrorSchema.safeParse(data);
  return {
    ok: false as const,
    message: error.success ? error.data.error : "tenant_status_update_failed",
    status: response.status,
  };
}
