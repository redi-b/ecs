import {
  platformErrorSchema,
  superadminTenantDetailSchema,
  superadminTenantListSchema,
} from "@ecs/contracts";
import { platformFetch } from "@/lib/platform-api/client";

export async function listSuperadminTenants(options: {
  cookieHeader?: string | null;
  limit?: number;
  offset?: number;
  platformApiBaseUrl?: string;
  query?: string;
}) {
  return request(options, "/platform/operator/tenants", superadminTenantListSchema, {
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
    q: options.query,
  });
}

export async function getSuperadminTenant(options: {
  cookieHeader?: string | null;
  platformApiBaseUrl?: string;
  tenantId: string;
}) {
  return request(
    options,
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}`,
    superadminTenantDetailSchema,
  );
}

async function request<T>(
  options: { cookieHeader?: string | null; platformApiBaseUrl?: string },
  path: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  searchParams?: Record<string, string | number | undefined>,
): Promise<{ ok: true; data: T } | { ok: false; message: string; status: number }> {
  const response = await platformFetch(path, {
    cookieHeader: options.cookieHeader,
    ...(options.platformApiBaseUrl ? { platformApiBaseUrl: options.platformApiBaseUrl } : {}),
    ...(searchParams ? { searchParams } : {}),
  });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = platformErrorSchema.safeParse(data);
    return {
      ok: false,
      message: error.success ? error.data.error : "superadmin_unavailable",
      status: response.status,
    };
  }
  const parsed = schema.safeParse(data);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, message: "invalid_superadmin_response", status: 502 };
}
