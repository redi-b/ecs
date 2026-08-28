import { platformErrorSchema, superadminDiagnosticsSchema } from "@ecs/contracts";

import { platformFetch } from "../client";

export async function getSuperadminDiagnostics(options: {
  cookieHeader?: string | null;
  platformApiBaseUrl?: string;
  tenantId: string;
}) {
  const response = await platformFetch(
    `/platform/operator/tenants/${encodeURIComponent(options.tenantId)}/diagnostics`,
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
      message: error.success ? error.data.error : "diagnostics_unavailable",
      status: response.status,
    };
  }
  const parsed = superadminDiagnosticsSchema.safeParse(data);
  return parsed.success
    ? { ok: true as const, diagnostics: parsed.data }
    : { ok: false as const, message: "invalid_diagnostics_response", status: 502 };
}
